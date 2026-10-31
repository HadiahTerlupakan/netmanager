import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { BillingEventDispatcher } from "@/modules/events";
import { InvoicePaymentStateService } from "./InvoicePaymentStateService";
import {
  creditPaymentOverpayment,
  type CreditablePayment,
} from "./overpayment-credit";

/**
 * Tagihan pengganti diterbitkan di permintaan yang sama dengan pembatalan
 * tagihan lamanya ("Batalkan & Buat Tagihan Baru", hitung ulang paket siklus).
 * Tagihan yang terbit jauh sesudahnya bukan pengganti.
 */
const REPLACEMENT_WINDOW_MS = 15 * 60 * 1000;
/** createdAt diisi jam database, updatedAt pembatalan diisi jam aplikasi. */
const CLOCK_SKEW_MS = 60 * 1000;
const OUTSTANDING_STATUSES = ["DRAFT", "SENT", "OVERDUE", "PARTIAL_PAID"];

/** Payment yang uangnya sudah diterima untuk tagihan yang dibatalkan. */
export type RedirectablePayment = CreditablePayment & { amount: bigint };

type CancelledInvoice = {
  id: string;
  invoiceNumber: string;
  pelangganId: string;
  tenantId: string | null;
  updatedAt: Date;
};

type ReplacementInvoice = { id: string; invoiceNumber: string };

const formatRupiah = (amount: bigint) =>
  `Rp ${Number(amount).toLocaleString("id-ID")}`;

/**
 * Uang yang datang untuk tagihan yang sudah dibatalkan (VA yang masih bisa
 * dibayar, bukti transfer yang disetujui belakangan) tidak menghidupkan lagi
 * tagihan itu. Payment-nya dipindah ke tagihan pengganti siklus itu bila masih
 * terbuka, sehingga sisa tagihan pengganti dilunasi lebih dulu; yang tidak
 * terpakai (atau seluruhnya, tanpa pengganti terbuka) menjadi saldo kredit.
 * Pelanggan menerima satu pemberitahuan ke mana uangnya pergi.
 *
 * Jurnal: payment yang dipindah dibukukan sebagai penerimaan tagihan pengganti
 * oleh worker INVOICE_PAID-nya. Tagihan batal tidak dihitung ulang dan tidak
 * mengirim INVOICE_PAID. Idempoten: payment hanya dipindah dari tagihan batal
 * dan kredit ditandai di payment-nya, jadi pemanggilan ulang tidak berbuat apa-apa.
 */
export async function redirectPaymentsOfCancelledInvoice(
  cancelledInvoiceId: string,
  payments: RedirectablePayment[],
) {
  const cancelled = await prismaBillingAuth.invoice.findUnique({
    where: { id: cancelledInvoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      pelangganId: true,
      tenantId: true,
      updatedAt: true,
    },
  });
  if (!cancelled) return;

  const replacement = await findReplacementInvoice(cancelled);
  const movedIds = replacement
    ? await movePayments(payments, cancelled, replacement)
    : new Set<string>();
  if (replacement && movedIds.size > 0) {
    await new InvoicePaymentStateService().recompute(replacement.id);
  }

  const outcome = await creditUnusedMoney(payments, cancelled, movedIds);
  if (movedIds.size === 0 && outcome.credited === 0n) return;

  logger.warn(
    `[Pelunasan] Uang untuk tagihan batal ${cancelled.invoiceNumber}: ${outcome.applied} ke ${replacement?.invoiceNumber ?? "-"}, ${outcome.credited} ke saldo kredit`,
  );
  await BillingEventDispatcher.onPaymentRedirected({
    invoiceId: cancelled.id,
    pelangganId: cancelled.pelangganId,
    cancelledInvoiceNumber: cancelled.invoiceNumber,
    replacementInvoiceId: movedIds.size > 0 ? replacement?.id : undefined,
    replacementInvoiceNumber:
      movedIds.size > 0 ? replacement?.invoiceNumber : undefined,
    amount: Number(outcome.applied + outcome.credited),
    appliedAmount: Number(outcome.applied),
    creditedAmount: Number(outcome.credited),
    tenantId: cancelled.tenantId ?? undefined,
  });
}

/** Tagihan langganan yang masih terbuka dan terbit bersama pembatalannya. */
async function findReplacementInvoice(
  cancelled: CancelledInvoice,
): Promise<ReplacementInvoice | null> {
  const cancelledAt = cancelled.updatedAt.getTime();
  return prismaBillingAuth.invoice.findFirst({
    where: {
      pelangganId: cancelled.pelangganId,
      id: { not: cancelled.id },
      kind: "SUBSCRIPTION",
      status: { in: OUTSTANDING_STATUSES as never },
      createdAt: {
        gte: new Date(cancelledAt - CLOCK_SKEW_MS),
        lte: new Date(cancelledAt + REPLACEMENT_WINDOW_MS),
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, invoiceNumber: true },
  });
}

/** Pindahkan payment yang sudah diterima; hanya yang masih di tagihan batal. */
async function movePayments(
  payments: RedirectablePayment[],
  cancelled: CancelledInvoice,
  replacement: ReplacementInvoice,
) {
  const note = `Tagihan ${cancelled.invoiceNumber} sudah dibatalkan; pembayaran ini dialihkan ke tagihan pengganti ${replacement.invoiceNumber}.`;
  const moved = new Set<string>();
  for (const payment of payments) {
    const count = await prismaBillingAuth.$executeRaw`
      UPDATE "Payment"
      SET "invoiceId" = ${replacement.id},
          "notes" = concat_ws(chr(10), "notes", ${note}::text),
          "updatedAt" = NOW()
      WHERE "id" = ${payment.id}
        AND "invoiceId" = ${cancelled.id}
        AND ("gatewayStatus" = 'PAID' OR "gatewayStatus" IS NULL)`;
    if (count > 0) moved.add(payment.id);
  }
  return moved;
}

/**
 * Kredit tanpa pemberitahuan terpisah: payment yang dipindah hanya untuk
 * bagian yang melebihi tagihan pengganti, yang tidak dipindah seluruhnya.
 */
async function creditUnusedMoney(
  payments: RedirectablePayment[],
  cancelled: CancelledInvoice,
  movedIds: Set<string>,
) {
  let applied = 0n;
  let credited = 0n;
  for (const payment of payments) {
    const isMoved = movedIds.has(payment.id);
    const kredit = await creditPaymentOverpayment(payment, {
      notify: false,
      note: isMoved
        ? undefined
        : (amount) =>
            `Tagihan ${cancelled.invoiceNumber} sudah dibatalkan; ${formatRupiah(amount)} dikreditkan ke saldo kredit pelanggan.`,
    });
    credited += kredit;
    if (isMoved) applied += payment.amount - kredit;
  }
  return { applied, credited };
}
