/** Status invoice yang belum menerima sepeser pun. */
const UNPAID_STATUSES = new Set(["DRAFT", "SENT", "OVERDUE"]);

/**
 * Payment yang sudah berakhir tanpa uang masuk. Selain ini, payment apa pun
 * berarti pelanggan sudah atau sedang membayar nominal invoice yang lama.
 */
const DEAD_PAYMENT_STATUSES = new Set(["FAILED", "EXPIRED", "REFUNDED"]);

/**
 * Jeda setelah batas waktu checkout sebelum dianggap mati; sama dengan jeda
 * penyapu checkout di `payment-gateway/services/abandoned-checkout.ts`, karena
 * notifikasi PAID gateway kadang datang sedikit setelah batas waktunya.
 */
const CHECKOUT_PAYABLE_GRACE_MS = 60 * 60 * 1000;

/** Alasan tagihan siklus dibiarkan dengan nominal lamanya. */
export type RepriceBlocker =
  | "NOT_UNPAID"
  | "PAYMENT_RECORDED"
  | "ACTIVE_CHECKOUT";

type PaymentState = { gatewayStatus: string | null; expiresAt: Date | null };

type InvoicePaymentState = {
  status: string;
  paidAmount: bigint;
  payment: PaymentState[];
};

/**
 * Apa yang menahan tagihan dari dihitung ulang; null bila aman diganti.
 *
 * Tagihan yang sudah menerima pembayaran, atau punya VA/QRIS yang nominalnya
 * sudah terkunci di gateway, tidak boleh berubah: pelanggan bisa saja sedang
 * mentransfer nominal lama, dan Duitku tidak bisa menutup VA lebih awal.
 */
export function findRepriceBlocker(
  invoice: InvoicePaymentState,
  now: Date,
): RepriceBlocker | null {
  if (!UNPAID_STATUSES.has(invoice.status)) return "NOT_UNPAID";
  if (BigInt(invoice.paidAmount) > 0n) return "PAYMENT_RECORDED";
  if (invoice.payment.some(isMoneyRecorded)) return "PAYMENT_RECORDED";
  if (invoice.payment.some((p) => isCheckoutStillPayable(p, now))) {
    return "ACTIVE_CHECKOUT";
  }
  return null;
}

// PAID dan null dihitung lunas (lihat InvoicePaymentStateService); PENDING
// tanpa expiresAt adalah transfer manual yang buktinya sedang diverifikasi.
function isMoneyRecorded(payment: PaymentState) {
  if (payment.gatewayStatus === null) return true;
  if (payment.gatewayStatus === "PAID") return true;
  return payment.gatewayStatus === "PENDING" && payment.expiresAt === null;
}

// Checkout yang dibatalkan karena ganti metode tetap bisa dibayar sampai
// kedaluwarsa; pembayaran manual yang dibatalkan (tanpa expiresAt) tidak.
function isCheckoutStillPayable(payment: PaymentState, now: Date) {
  if (DEAD_PAYMENT_STATUSES.has(payment.gatewayStatus ?? "")) return false;
  if (!payment.expiresAt) return false;
  return (
    payment.expiresAt.getTime() + CHECKOUT_PAYABLE_GRACE_MS > now.getTime()
  );
}
