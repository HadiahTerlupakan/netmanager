import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";

function getPaymentRepository() {
  return new PaymentRepository();
}

function getInvoiceRepository() {
  return new InvoiceRepository();
}

/** Creates pending customer payments for selected invoices. */
export function createCustomerPaymentsForInvoices(options: {
  customerId: string;
  tenantId?: string | null;
  invoiceIds: string[];
  discountAmount: number;
  paymentMethod: string;
  notes?: string | null;
  couponUsageId?: string | null;
  couponId?: string | null;
}) {
  return getPaymentRepository().createCustomerPaymentsForInvoices(options);
}

/** Marks customer payments as FAILED with the gateway's rejection text. */
export function markCustomerPaymentsAsFailed(
  paymentIds: string[],
  failureReason: string,
) {
  return getPaymentRepository().markAsFailed(paymentIds, failureReason);
}

/** Stores payment gateway metadata on customer payments. */
export function updateCustomerPaymentGatewayMetadata(options: {
  paymentIds: string[];
  tenantId?: string | null;
  transactionId?: string | null;
  paymentUrl?: string | null;
  vaNumber?: string | null;
  qrString?: string | null;
  expiresAt?: Date | null;
  gatewayProvider?: string | null;
}) {
  return getPaymentRepository().updateGatewayMetadata(options);
}

/**
 * Payment transfer manual pelanggan yang masih menunggu verifikasi dari
 * checkout yang memuat invoice ini; kosong bila tidak ada.
 */
export function findPendingManualCustomerCheckout(options: {
  invoiceId: string;
  customerId: string;
}) {
  return getPaymentRepository().findPendingManualCheckout({
    invoiceId: options.invoiceId,
    pelangganId: options.customerId,
  });
}

/** Melampirkan bukti transfer ke payment checkout yang masih menunggu. */
export function attachCustomerCheckoutReceipt(options: {
  receiptUrl: string;
  payments: Array<{ id: string; notes: string }>;
}) {
  return getPaymentRepository().attachReceipt(options);
}

/**
 * Menutup seluruh payment transfer manual menunggu sebuah checkout pelanggan,
 * atau tidak sama sekali bila admin sudah atau sedang memprosesnya.
 */
export function cancelPendingManualCustomerPayments(options: {
  customerId: string;
  checkoutId: string | null;
  paymentIds: string[];
}) {
  return getPaymentRepository().cancelPendingManual({
    pelangganId: options.customerId,
    checkoutId: options.checkoutId,
    paymentIds: options.paymentIds,
  });
}

/** Returns customer invoice status used by customer payment polling. */
export async function getCustomerInvoicePaymentStatus(options: {
  invoiceId: string;
  customerId: string;
}) {
  const snapshot = await getCustomerInvoicePaymentSnapshot(options);
  return snapshot?.status ?? null;
}

/**
 * Status untuk SSE portal dan aplikasi. `paymentId` membuat halaman yang
 * terbuka di perangkat lain tahu bahwa metode bayar sudah diganti, sehingga
 * tidak menampilkan VA/QR lama yang sudah ditutup.
 */
export async function getCustomerInvoicePaymentSnapshot(options: {
  invoiceId: string;
  customerId: string;
}) {
  const invoice = await getInvoiceRepository().findCustomerPaymentStatus({
    invoiceId: options.invoiceId,
    pelangganId: options.customerId,
  });
  if (!invoice) {
    return null;
  }
  const latest = await preferOpenCheckout(invoice.payment[0], options);
  return {
    status: resolveEffectivePaymentStatus(invoice.status, latest),
    paymentId: latest?.id ?? null,
    gatewayStatus: latest?.gatewayStatus ?? null,
  };
}

type LatestPayment = { id: string; gatewayStatus: string | null } | undefined;

/**
 * Percobaan ganti metode yang ditolak gateway (FAILED) tidak menutupi
 * checkout lama yang masih menunggu; tanpa ini perangkat lain menyembunyikan
 * VA/QR yang masih bisa dibayar, dan aplikasi menampilkan "gagal".
 */
async function preferOpenCheckout(
  latest: LatestPayment,
  options: { invoiceId: string; customerId: string },
): Promise<LatestPayment> {
  if (latest?.gatewayStatus !== "FAILED") return latest;
  const pending = await getPaymentRepository().findLatestPending({
    invoiceId: options.invoiceId,
    pelangganId: options.customerId,
  });
  return pending ?? latest;
}

function resolveEffectivePaymentStatus(
  invoiceStatus: string,
  latest: LatestPayment,
) {
  if (invoiceStatus === "PAID" || !latest) {
    return invoiceStatus;
  }
  // Aplikasi mobile sudah menangani EXPIRED (muat ulang tanpa pesan "ditolak
  // admin" yang dipakainya untuk FAILED).
  if (latest.gatewayStatus === "EXPIRED") return "EXPIRED";
  const isFailedStatus =
    latest.gatewayStatus === "FAILED" || latest.gatewayStatus === "CANCELLED";
  return isFailedStatus ? "FAILED" : invoiceStatus;
}
