import { prismaBillingAuth } from "@/lib/prisma-billing";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { recomputeInvoicePaymentState } from "@/modules/finance";

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
 * Hitung ulang status invoice lewat jalur yang sama dengan persetujuan
 * transfer manual: potongan kupon ikut terhitung, jadwal tagihan dibereskan,
 * dan INVOICE_PAID (aktivasi pelanggan isolir) dikirim lewat event bus
 * database utama. Webhook datang tanpa konteks tenant, jadi konteksnya
 * diambil dari payment.
 */
export async function settleCheckoutInvoices(payments: CheckoutPayment[]) {
  const settled = new Set<string>();
  for (const payment of payments) {
    const invoiceId = payment.invoiceId;
    if (!invoiceId || settled.has(invoiceId)) continue;
    settled.add(invoiceId);

    const recompute = () => recomputeInvoicePaymentState(invoiceId);
    await (payment.tenantId
      ? runWithRequestTenantContext(
          { tenantId: payment.tenantId, isSuperAdmin: false },
          recompute,
        )
      : runAsSystemContext("webhook: payment tanpa tenant", recompute));
  }
}
