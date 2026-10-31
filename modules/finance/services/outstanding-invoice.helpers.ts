import { logger } from "@/lib/logger";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import { InvoiceStatus } from "../types/invoice.enums";
import type { Prisma } from "../lib/billing-prisma-boundary";
import {
  findPayableCheckout,
  findRepriceBlocker,
  isTransferAwaitingVerification,
  type RepriceBlocker,
} from "./cycle-invoice-reprice";
import { closeAbandonedManualTransfers } from "./abandoned-manual-transfer";
import { FinanceRepositoryFacade } from "./FinanceRepositoryFacade";
import { reverseJournalsOfCancelledInvoice } from "./invoice-cancellation-journals";
import { readSaldoKreditUsed } from "./saldo-kredit-note";

/** Status invoice yang masih dianggap tagihan hidup dan boleh diganti. */
const REPLACEABLE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
];

const CANCELLED_BY_ADMIN_REASON = "Tagihan dibatalkan admin";
const PENDING_PROOF_BLOCKS_DELETE =
  "Tagihan punya bukti transfer yang belum diverifikasi; tolak atau setujui dulu.";

const FORMAT_WAKTU = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

type ReplaceablePayment = {
  gatewayStatus: string | null;
  expiresAt: Date | null;
  receiptUrl: string | null;
  gatewayProvider: string | null;
};

type ReplaceableInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  paidAmount: bigint;
  tenantId: string | null;
  payment: ReplaceablePayment[];
};

type DescribeMethod = (code: string) => string | undefined;

/** Tagihan yang tidak dibatalkan dan alasannya, untuk ditampilkan ke admin. */
export type KeptInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  reason: RepriceBlocker;
  message: string;
};

export type ReplaceOutstandingInvoiceResult = {
  cancelledInvoiceIds: string[];
  invoice: { id: string } | null;
  keptInvoices: KeptInvoice[];
};

/**
 * Membatalkan tagihan hidup pelanggan lalu menerbitkan penggantinya (aksi
 * admin "Batalkan & Buat Tagihan Baru"). Pemanggil menjalankannya di bawah
 * kunci checkout pelanggan.
 *
 * Penjaganya sama dengan hitung ulang paket siklus (`findRepriceBlocker`):
 * tagihan yang sudah menerima uang, punya VA/QRIS yang masih bisa dibayar,
 * atau bukti transfer yang menunggu verifikasi tidak dibatalkan, karena
 * pelanggan sedang membayar nominal lamanya dan Duitku tidak bisa menutup VA
 * lebih awal. Semua atau tidak sama sekali: bila satu tagihan tertahan, tidak
 * ada yang dibatalkan dan tidak ada tagihan baru, supaya pelanggan tidak
 * berakhir dengan dua tagihan untuk satu periode.
 *
 * Pembatalan dijalankan lebih dulu dan tidak ditelan: kalau gagal, tagihan
 * pengganti tidak dibuat.
 */
export async function replaceOutstandingInvoiceForCustomer(options: {
  pelangganId: string;
  invoiceRepo: InvoiceRepository;
  createInvoice: () => Promise<{ id: string } | null>;
  /** Nama metode untuk kode channel gateway (mis. "BC"). */
  describeMethod?: DescribeMethod;
  now?: Date;
}): Promise<ReplaceOutstandingInvoiceResult> {
  const now = options.now ?? new Date();
  const invoices = await findInvoicesWithPaymentState(options.invoiceRepo, {
    pelangganId: options.pelangganId,
    status: { in: [...REPLACEABLE_STATUSES] },
  });
  const blocked = findBlockedInvoices(invoices, now, options.describeMethod);
  if (blocked.length > 0) return keepAll(options.pelangganId, blocked, []);

  const cancelledInvoiceIds: string[] = [];
  const paidMeanwhile: KeptInvoice[] = [];
  for (const invoice of invoices) {
    const cancelled = await cancelReplacedInvoice({
      invoiceRepo: options.invoiceRepo,
      invoice,
    });
    if (cancelled) cancelledInvoiceIds.push(invoice.id);
    else paidMeanwhile.push(keptBecauseJustPaid(invoice));
  }
  if (paidMeanwhile.length > 0) {
    return keepAll(options.pelangganId, paidMeanwhile, cancelledInvoiceIds);
  }

  const invoice = await options.createInvoice();
  logger.info(
    `[Billing] Tagihan pelanggan ${options.pelangganId} diganti — dibatalkan: ${cancelledInvoiceIds.length}`,
  );
  return { cancelledInvoiceIds, invoice, keptInvoices: [] };
}

/**
 * Membatalkan satu tagihan yang akan diganti tagihan baru ("Batalkan & Buat
 * Tagihan Baru", hitung ulang paket siklus); pelanggan membayar tagihan
 * penggantinya. Saldo kredit dikembalikan sebelum tagihan pengganti dibuat
 * sehingga pengganti memakainya lagi sesuai nominal barunya.
 *
 * @returns false bila tagihan tidak lagi bisa dibatalkan.
 */
export function cancelReplacedInvoice(options: {
  invoiceRepo: InvoiceRepository;
  invoice: { id: string; tenantId: string | null };
}): Promise<boolean> {
  return cancelUnpaidInvoice({
    ...options,
    reason: "Tagihan diganti dengan tagihan baru",
    reversedBy: "Sistem",
  });
}

/**
 * Pembatalan satu tagihan oleh admin lewat ubah tagihan (mis. "Batalkan
 * tagihan" di halaman perpanjangan), dengan penjaga dan efek yang sama dengan
 * "Batalkan & Buat Tagihan Baru": tagihan yang sudah menerima uang, punya
 * VA/QRIS yang masih bisa dibayar, atau bukti transfer yang menunggu
 * verifikasi tidak dibatalkan. Pemanggil menjalankannya di bawah kunci
 * checkout pelanggan, supaya pelanggan tidak membuat VA di antara pemeriksaan
 * dan pembatalan.
 *
 * @returns null bila dibatalkan (atau tagihannya sudah tidak ada); selain itu
 *   tagihan yang dibiarkan beserta pesan untuk admin.
 */
export async function cancelOutstandingInvoice(options: {
  invoiceRepo: InvoiceRepository;
  invoiceId: string;
  /** Admin yang membatalkan; dicatat di jurnal pembalik. */
  cancelledBy: string;
  describeMethod?: DescribeMethod;
  now?: Date;
}): Promise<KeptInvoice | null> {
  const [invoice] = await findInvoicesWithPaymentState(options.invoiceRepo, {
    id: options.invoiceId,
  });
  if (!invoice) return null;

  const [blocked] = findBlockedInvoices(
    [invoice],
    options.now ?? new Date(),
    options.describeMethod,
  );
  if (blocked) return blocked;

  const cancelled = await cancelUnpaidInvoice({
    invoiceRepo: options.invoiceRepo,
    invoice,
    reason: CANCELLED_BY_ADMIN_REASON,
    reversedBy: options.cancelledBy,
  });
  return cancelled ? null : keptBecauseJustPaid(invoice);
}

/**
 * Alasan tagihan tidak boleh dihapus, atau null. Penghapusan melepas
 * invoiceId payment-nya (SET NULL): bukti transfer yang menunggu verifikasi
 * lalu disetujui tidak melunasi atau mengkreditkan apa pun, dan VA/QRIS yang
 * masih bisa dibayar menerima uang tanpa tagihan. Pemanggil menjalankannya di
 * bawah kunci checkout pelanggan bersama penghapusannya.
 */
export async function findInvoiceDeleteBlocker(options: {
  invoiceRepo: InvoiceRepository;
  invoiceId: string;
  describeMethod?: DescribeMethod;
  now?: Date;
}): Promise<string | null> {
  const [invoice] = await findInvoicesWithPaymentState(options.invoiceRepo, {
    id: options.invoiceId,
  });
  if (!invoice) return null;
  if (invoice.payment.some(isTransferAwaitingVerification)) {
    return PENDING_PROOF_BLOCKS_DELETE;
  }
  const checkout = findPayableCheckout(
    invoice.payment,
    options.now ?? new Date(),
  );
  if (!checkout) return null;
  return `Tagihan sedang dibayar pelanggan (${describeCheckout(checkout, options.describeMethod)}); tunggu sampai dibayar atau kedaluwarsa.`;
}

/**
 * Membatalkan satu tagihan yang belum menerima pembayaran beserta efeknya:
 * status, durable schedule, saldo kredit yang dipakainya, jurnalnya, dan
 * pilihan "Transfer Manual" untuknya yang belum membawa bukti.
 *
 * Pembatalannya bersyarat (masih DRAFT/SENT/OVERDUE tanpa pembayaran): tagihan
 * yang baru saja dilunasi, misalnya oleh webhook yang datang bersamaan, tidak
 * pernah dibatalkan. Potongan selain saldo kredit (diskon admin, kupon) tidak
 * dikembalikan.
 *
 * @returns false bila tagihan tidak lagi bisa dibatalkan.
 */
async function cancelUnpaidInvoice(options: {
  invoiceRepo: InvoiceRepository;
  invoice: { id: string; tenantId: string | null };
  /** Alasan dan pelaku di jurnal pembalik. */
  reason: string;
  reversedBy: string;
}): Promise<boolean> {
  const cancelled = await options.invoiceRepo.cancelIfUnpaid(
    options.invoice.id,
    REPLACEABLE_STATUSES,
    new Date(),
  );
  if (!cancelled) return false;

  await cancelSchedulesForInvoice(cancelled.id);
  const saldoUsed = readSaldoKreditUsed(cancelled);
  if (saldoUsed > 0n && cancelled.pelangganId) {
    await FinanceRepositoryFacade.refundSaldoKredit(
      cancelled.pelangganId,
      saldoUsed,
    );
  }
  await reverseJournalsOfCancelledInvoice({
    invoiceId: options.invoice.id,
    tenantId: options.invoice.tenantId,
    reason: options.reason,
    reversedBy: options.reversedBy,
  });
  await closeAbandonedManualTransfers(cancelled.id);
  return true;
}

/** Tagihan beserta jejak pembayaran yang menentukan boleh tidaknya diubah. */
async function findInvoicesWithPaymentState(
  invoiceRepo: InvoiceRepository,
  where: Prisma.InvoiceWhereInput,
): Promise<ReplaceableInvoice[]> {
  return (await invoiceRepo.findUnpaidInvoices(where, {
    id: true,
    invoiceNumber: true,
    status: true,
    paidAmount: true,
    tenantId: true,
    payment: {
      select: {
        gatewayStatus: true,
        expiresAt: true,
        receiptUrl: true,
        gatewayProvider: true,
      },
    },
  })) as unknown as ReplaceableInvoice[];
}

function findBlockedInvoices(
  invoices: ReplaceableInvoice[],
  now: Date,
  describeMethod: DescribeMethod | undefined,
): KeptInvoice[] {
  return invoices.flatMap((invoice) => {
    const reason = findRepriceBlocker(invoice, now);
    if (!reason) return [];
    return [
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        reason,
        message: describeBlocker(invoice, reason, now, describeMethod),
      },
    ];
  });
}

function describeBlocker(
  invoice: ReplaceableInvoice,
  reason: RepriceBlocker,
  now: Date,
  describeMethod: DescribeMethod | undefined,
) {
  const head = `Tagihan ${invoice.invoiceNumber} tidak dibatalkan karena`;
  const checkout =
    reason === "ACTIVE_CHECKOUT"
      ? findPayableCheckout(invoice.payment, now)
      : null;
  if (checkout?.expiresAt) {
    return `${head} pelanggan sedang membayar (${describeCheckout(checkout, describeMethod)}).`;
  }
  if (invoice.payment.some(isTransferAwaitingVerification)) {
    return `${head} ada bukti transfer yang menunggu verifikasi; setujui atau tolak dulu di Verifikasi Pembayaran Manual.`;
  }
  return `${head} sudah menerima pembayaran.`;
}

/** Metode dan batas waktu checkout yang masih bisa dibayar, untuk admin. */
function describeCheckout(
  checkout: ReplaceablePayment,
  describeMethod: DescribeMethod | undefined,
) {
  const method =
    (checkout.gatewayProvider && describeMethod?.(checkout.gatewayProvider)) ||
    "pembayaran online";
  return `${method} aktif sampai ${FORMAT_WAKTU.format(checkout.expiresAt)} WIB`;
}

function keptBecauseJustPaid(invoice: ReplaceableInvoice): KeptInvoice {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    reason: "NOT_UNPAID",
    message: `Tagihan ${invoice.invoiceNumber} tidak dibatalkan karena baru saja menerima pembayaran.`,
  };
}

function keepAll(
  pelangganId: string,
  keptInvoices: KeptInvoice[],
  cancelledInvoiceIds: string[],
): ReplaceOutstandingInvoiceResult {
  logger.warn(
    `[Billing] Tagihan pelanggan ${pelangganId} tidak diganti: ${keptInvoices
      .map((kept) => `${kept.invoiceNumber} (${kept.reason})`)
      .join(", ")}`,
  );
  return { cancelledInvoiceIds, invoice: null, keptInvoices };
}

/** Membatalkan durable schedule milik invoice yang baru dibatalkan. */
async function cancelSchedulesForInvoice(invoiceId: string) {
  try {
    const { cancelInvoiceBillingSchedules } =
      await import("./billingScheduleLifecycle");
    await cancelInvoiceBillingSchedules(invoiceId);
  } catch (error) {
    logger.error(
      `[Billing] Gagal membatalkan schedule untuk invoice ${invoiceId}:`,
      error instanceof Error ? error : undefined,
    );
  }
}
