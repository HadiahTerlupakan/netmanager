import { prismaBillingAuth } from "@/lib/prisma-billing";
import { settleInvoicesOfReceivedPayments } from "@/modules/finance";

const CHECKOUT_PAYMENT_SELECT = {
  id: true,
  amount: true,
  invoiceId: true,
  tenantId: true,
  couponUsageId: true,
  couponId: true,
  pelangganId: true,
} as const;

export type CheckoutPayment = {
  id: string;
  amount: bigint;
  invoiceId: string | null;
  tenantId: string | null;
  couponUsageId: string | null;
  couponId: string | null;
  pelangganId: string;
};

/**
 * Semua payment dari satu checkout gateway. Checkout beberapa invoice membuat
 * satu payment per invoice, tetapi gateway hanya mengenal orderId payment
 * pertama dan menagih totalnya. Payment lama tanpa checkoutId berdiri
 * sendiri.
 */
export async function findCheckoutPayments(
  paymentId: string,
): Promise<CheckoutPayment[]> {
  const payment = await prismaBillingAuth.payment.findUnique({
    where: { id: paymentId },
    select: { ...CHECKOUT_PAYMENT_SELECT, checkoutId: true },
  });
  if (!payment) {
    return [];
  }
  if (!payment.checkoutId) {
    return [payment];
  }

  return prismaBillingAuth.payment.findMany({
    where: { checkoutId: payment.checkoutId },
    select: CHECKOUT_PAYMENT_SELECT,
  });
}

/** Nominal yang ditagihkan gateway untuk satu checkout. */
export function sumCheckoutAmount(payments: CheckoutPayment[]): bigint {
  return payments.reduce((sum, payment) => sum + payment.amount, 0n);
}

/**
 * Lunasi invoice checkout yang sudah dibayar lewat jalur yang sama dengan
 * persetujuan transfer manual: potongan kupon ikut terhitung, INVOICE_PAID
 * terkirim sekali, dan tagihan yang sudah dibatalkan tidak dihidupkan lagi
 * (uangnya ke tagihan pengganti atau saldo kredit). Kelebihan bayar
 * dikreditkan oleh `creditCheckoutOverpayment` sesudahnya. Keduanya idempoten:
 * webhook, cek status gateway, dan penyapu checkout memanggil pasangan yang
 * sama setelah checkout ditandai PAID.
 */
export async function settleCheckoutInvoices(payments: CheckoutPayment[]) {
  await settleInvoicesOfReceivedPayments(payments);
}
