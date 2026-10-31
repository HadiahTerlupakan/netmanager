import { createRouteServiceError } from "@/lib/api/route-service-error";
import {
  cancelPendingManualCustomerPayments,
  findPendingManualCustomerCheckout,
  getCustomerInvoicePaymentStatus,
} from "@/modules/finance";
import {
  reconcileInvoiceCheckout,
  releaseUnusedCheckoutCoupons,
  withCustomerCheckoutLock,
  type CheckoutReconciliation,
} from "@/modules/payment-gateway";

const HTTP_CONFLICT = 409;
const NOTHING_TO_CANCEL_MESSAGE =
  "Tidak ada transfer manual menunggu yang bisa dibatalkan untuk tagihan ini.";
const CHANGED_BY_ADMIN_MESSAGE =
  "Transfer manual ini baru saja diproses admin. Muat ulang halaman untuk melihat statusnya.";

/** Jawaban cek status pembayaran untuk portal dan aplikasi. */
export type CustomerCheckoutStatus =
  | "PAID"
  | "PENDING"
  | "EXPIRED"
  | "FAILED"
  | "NONE";

/**
 * Status pembayaran tagihan saat pelanggan kembali dari halaman bayar.
 * Checkout gateway yang menunggu ditanyakan ke gateway, dan dilunasi lewat
 * jalur webhook bila uangnya sudah masuk walau callback-nya belum sampai.
 * Transfer manual menunggu verifikasi admin, jadi selalu PENDING.
 */
export async function checkCustomerPaymentStatus(input: {
  customerId: string;
  invoiceId: string;
}): Promise<CustomerCheckoutStatus> {
  const gateway = await reconcileInvoiceCheckout(input);
  if (gateway) return toCustomerStatus(gateway);

  const manual = await findPendingManualCustomerCheckout(input);
  if (manual.length > 0) return "PENDING";

  // Callback yang sudah melunasi sebelum pelanggan kembali.
  const invoiceStatus = await getCustomerInvoicePaymentStatus(input);
  return invoiceStatus === "PAID" ? "PAID" : "NONE";
}

function toCustomerStatus(
  reconciliation: CheckoutReconciliation,
): CustomerCheckoutStatus {
  switch (reconciliation.outcome) {
    case "PAID":
      return "PAID";
    // Status yang tidak terbaca: checkout-nya masih menunggu di catatan kita.
    case "UNKNOWN":
      return "PENDING";
    case "UNPAID":
      if (reconciliation.gatewayStatus === "PENDING") return "PENDING";
      return reconciliation.gatewayStatus === "FAILED" ? "FAILED" : "EXPIRED";
  }
}

/**
 * Batalkan transfer manual menunggu yang memuat tagihan ini, seluruh
 * checkout-nya sekaligus, selama admin belum memverifikasinya; kuponnya
 * dikembalikan bila tidak ada invoice checkout itu yang sudah lunas dengan
 * potongannya. Checkout gateway tidak dibatalkan di sini: memilih metode lain
 * menggantikannya.
 */
export function cancelCustomerManualCheckout(input: {
  customerId: string;
  invoiceId: string;
}): Promise<void> {
  return withCustomerCheckoutLock(input.customerId, async () => {
    const checkout = await findPendingManualCustomerCheckout(input);
    if (checkout.length === 0) {
      throw createRouteServiceError(NOTHING_TO_CANCEL_MESSAGE, HTTP_CONFLICT);
    }
    const isCancelled = await cancelPendingManualCustomerPayments({
      customerId: input.customerId,
      checkoutId: checkout[0].checkoutId,
      paymentIds: checkout.map((p) => p.id),
    });
    if (!isCancelled) {
      throw createRouteServiceError(CHANGED_BY_ADMIN_MESSAGE, HTTP_CONFLICT);
    }
    await releaseUnusedCheckoutCoupons(checkout);
  });
}
