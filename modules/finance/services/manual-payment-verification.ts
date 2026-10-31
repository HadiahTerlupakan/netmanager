import { createRouteServiceError } from "@/lib/api/route-service-error";
import { sendCustomerPushNotification } from "@/modules/notification";
import {
  claimPendingPayments,
  findPendingCheckoutPayments,
  findSettledPayments,
  type VerifiablePayment,
} from "../repositories/manualPaymentVerification.repository";
import { InvoiceStatus } from "../types/invoice.enums";
import { settleReceivedPayments } from "./received-payment-settlement";

const HTTP_NOT_FOUND = 404;
export const PAYMENT_NOT_FOUND_MESSAGE =
  "Payment not found or already processed";

const formatRupiah = (amount: bigint) =>
  `Rp ${Number(amount).toLocaleString("id-ID")}`;

/** Hasil verifikasi untuk admin; `warnings` menjelaskan uang yang tidak melunasi tagihannya sendiri. */
export type ManualVerificationResult = {
  success: true;
  message: string;
  warnings: string[];
};

/**
 * Transfer manual (rekening bank, mutasi Moota): bukan checkout gateway, yang
 * hanya boleh dilunasi oleh webhook atau cek status gateway. Tanpa pemeriksaan
 * ini admin bisa "menyetujui" VA yang belum dibayar lewat id payment-nya.
 */
export function isManualTransferPayment(payment: {
  paymentMethod: string;
  expiresAt: Date | null;
  transactionId: string | null;
  gatewayProvider: string | null;
}): boolean {
  return (
    payment.paymentMethod === "BANK_TRANSFER" &&
    payment.expiresAt === null &&
    payment.transactionId === null &&
    payment.gatewayProvider === null
  );
}

/**
 * Setujui bukti transfer untuk seluruh checkout-nya, lalu lunasi lewat jalur
 * yang sama dengan webhook gateway: tagihan yang sudah lunas atau dibatalkan
 * tidak dilunasi dua kali; uangnya ke tagihan pengganti atau saldo kredit, dan
 * admin menerima penjelasannya di `warnings`.
 */
export async function approveManualCheckout(
  payment: VerifiablePayment,
  options: { notes?: string | null; verifiedBy?: string | null },
): Promise<ManualVerificationResult> {
  const checkout = await findPendingCheckoutPayments(payment);
  const now = new Date();
  const approvedIds = await claimPendingPayments(checkout, (pending) => ({
    gatewayStatus: "PAID",
    paymentDate: now,
    verifiedAt: now,
    verifiedBy: options.verifiedBy ?? null,
    notes: appendNote(pending.notes, options.notes),
  }));
  if (approvedIds.length === 0) {
    throw createRouteServiceError(PAYMENT_NOT_FOUND_MESSAGE, HTTP_NOT_FOUND);
  }

  const approved = checkout.filter((p) => approvedIds.includes(p.id));
  await settleReceivedPayments(approved);
  const settled = await findSettledPayments(approvedIds);
  await notifyRemainingBalance(approved, settled);

  return {
    success: true,
    message: "Payment approved",
    warnings: describeSettlement(approved, settled),
  };
}

/** Tolak bukti transfer untuk seluruh checkout-nya; hanya yang masih PENDING. */
export async function rejectManualCheckout(
  payment: VerifiablePayment,
  options: { notes?: string | null; verifiedBy?: string | null },
): Promise<ManualVerificationResult> {
  const checkout = await findPendingCheckoutPayments(payment);
  const now = new Date();
  const rejectedIds = await claimPendingPayments(checkout, (pending) => ({
    gatewayStatus: "FAILED",
    verifiedAt: now,
    verifiedBy: options.verifiedBy ?? null,
    notes: options.notes || pending.notes || null,
  }));
  if (rejectedIds.length === 0) {
    throw createRouteServiceError(PAYMENT_NOT_FOUND_MESSAGE, HTTP_NOT_FOUND);
  }

  await sendCustomerPushNotification(
    payment.pelangganId,
    "Pembayaran Ditolak",
    "Pembayaran Anda ditolak. Mohon periksa kembali bukti transfer Anda.",
    { paymentId: payment.id, invoiceId: payment.invoiceId, action: "REJECT" },
  );
  return { success: true, message: "Payment rejected", warnings: [] };
}

function appendNote(existing: string | null, note: string | null | undefined) {
  if (!note) return existing;
  return existing ? `${existing}\nCatatan verifikasi: ${note}` : note;
}

type SettledPayment = Awaited<ReturnType<typeof findSettledPayments>>[number];

/** Penjelasan untuk admin bila uang tidak (seluruhnya) melunasi tagihannya. */
function describeSettlement(
  approved: VerifiablePayment[],
  settled: SettledPayment[],
): string[] {
  return approved.flatMap((before) => {
    const after = settled.find((p) => p.id === before.id);
    const original = before.invoice?.invoiceNumber ?? "-";
    const credited = after?.kelebihanBayar ?? 0n;
    const toSaldo = `${formatRupiah(credited)} dikreditkan ke saldo kredit pelanggan`;
    if (after && after.invoiceId !== before.invoiceId) {
      return [
        `Tagihan ${original} sudah dibatalkan; pembayarannya dipakai untuk tagihan pengganti ${after.invoice?.invoiceNumber ?? "-"}${credited > 0n ? `, dan ${toSaldo}` : ""}.`,
      ];
    }
    if (credited <= 0n) return [];
    const reason =
      after?.invoice?.status === InvoiceStatus.CANCELLED
        ? "sudah dibatalkan"
        : "sudah lunas";
    return [`Tagihan ${original} ${reason}; ${toSaldo}.`];
  });
}

/**
 * Tagihan yang jadi lunas sudah diberitahukan lewat INVOICE_PAID (in-app,
 * push, WhatsApp, email); push langsung di sini membuat pelanggan menerima
 * dua push. Yang tersisa hanya tagihan yang masih dibayar sebagian.
 */
async function notifyRemainingBalance(
  approved: VerifiablePayment[],
  settled: SettledPayment[],
) {
  const partial = settled.filter(
    (p) => p.invoice?.status === InvoiceStatus.PARTIAL_PAID,
  );
  for (const payment of partial) {
    const owner = approved.find((p) => p.id === payment.id);
    if (!owner) continue;
    await sendCustomerPushNotification(
      owner.pelangganId,
      "Pembayaran Diterima",
      "Pembayaran Anda sudah kami terima. Sisa tagihan masih perlu dilunasi.",
      {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        action: "APPROVE",
      },
    );
  }
}
