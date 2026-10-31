import { logger } from "@/lib/logger";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import { reverseJournalsOfCancelledInvoice } from "./invoice-cancellation-journals";

/** Status invoice yang masih dianggap tagihan hidup dan boleh diganti. */
const REPLACEABLE_STATUSES = ["DRAFT", "SENT", "OVERDUE"] as const;

type CancellableInvoice = {
  id: string;
  status: string;
  paidAmount: bigint;
  tenantId: string | null;
};

/**
 * Membatalkan tagihan hidup milik pelanggan sebelum tagihan pengganti dibuat.
 *
 * Invoice yang sudah menyerap pembayaran sengaja dilewati: membatalkannya akan
 * membuat payment yatim yang tidak lagi terhubung ke tagihan mana pun.
 *
 * @returns id invoice yang benar-benar dibatalkan.
 */
export async function cancelOutstandingInvoices(options: {
  pelangganId: string;
  invoiceRepo: InvoiceRepository;
}): Promise<string[]> {
  const cancellable = await findCancellableInvoices(options);
  const cancelledIds: string[] = [];

  for (const invoice of cancellable) {
    await cancelReplacedInvoice({ invoiceRepo: options.invoiceRepo, invoice });
    cancelledIds.push(invoice.id);
  }

  return cancelledIds;
}

/**
 * Membatalkan satu tagihan yang akan diganti tagihan baru: status, durable
 * schedule, dan jurnalnya. Pemanggil yang memastikan tagihan belum dibayar.
 */
export async function cancelReplacedInvoice(options: {
  invoiceRepo: InvoiceRepository;
  invoice: { id: string; tenantId: string | null };
}) {
  await cancelSingleInvoice(options.invoiceRepo, options.invoice.id);
  await reverseJournalsOfCancelledInvoice({
    invoiceId: options.invoice.id,
    tenantId: options.invoice.tenantId,
    reason: "Tagihan diganti dengan tagihan baru",
    reversedBy: "Sistem",
  });
}

/** Tagihan hidup tanpa pembayaran yang menempel. */
async function findCancellableInvoices(options: {
  pelangganId: string;
  invoiceRepo: InvoiceRepository;
}): Promise<CancellableInvoice[]> {
  const candidates = (await options.invoiceRepo.findUnpaidInvoices(
    {
      pelangganId: options.pelangganId,
      status: { in: [...REPLACEABLE_STATUSES] },
    },
    { id: true, status: true, paidAmount: true, tenantId: true },
  )) as unknown as CancellableInvoice[];

  return candidates.filter(
    (invoice) => BigInt(invoice.paidAmount ?? 0n) === 0n,
  );
}

async function cancelSingleInvoice(
  invoiceRepo: InvoiceRepository,
  invoiceId: string,
) {
  await invoiceRepo.update(invoiceId, {
    status: "CANCELLED",
    updatedAt: new Date(),
  });
  await cancelSchedulesForInvoice(invoiceId);
}

/**
 * Membatalkan tagihan hidup lalu menerbitkan penggantinya.
 * Pembatalan dijalankan lebih dulu dan tidak ditelan: kalau gagal, tagihan
 * pengganti tidak dibuat supaya pelanggan tidak berakhir dengan dua tagihan.
 */
export async function replaceOutstandingInvoiceForCustomer(options: {
  pelangganId: string;
  invoiceRepo: InvoiceRepository;
  createInvoice: () => Promise<{ id: string } | null>;
}) {
  const cancelledInvoiceIds = await cancelOutstandingInvoices({
    pelangganId: options.pelangganId,
    invoiceRepo: options.invoiceRepo,
  });
  const invoice = await options.createInvoice();

  logger.info(
    `[Billing] Tagihan pelanggan ${options.pelangganId} diganti — dibatalkan: ${cancelledInvoiceIds.length}`,
  );

  return { cancelledInvoiceIds, invoice };
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
