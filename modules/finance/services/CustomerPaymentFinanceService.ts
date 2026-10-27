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

/** Marks customer payments as FAILED when gateway call fails. */
export function markCustomerPaymentsAsFailed(paymentIds: string[]) {
  return getPaymentRepository().markAsFailed(paymentIds);
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

/** Finds pending manual transfer payment for customer receipt upload. */
export function findPendingManualCustomerTransfer(options: {
  invoiceId: string;
  customerId: string;
}) {
  return getPaymentRepository().findPendingManualTransfer({
    invoiceId: options.invoiceId,
    pelangganId: options.customerId,
  });
}

/** Updates customer payment receipt metadata. */
export function updateCustomerPaymentReceipt(options: {
  paymentId: string;
  receiptUrl: string;
  notes: string;
}) {
  return getPaymentRepository().updateReceipt(options);
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
  const latest = invoice.payment[0];
  return {
    status: resolveEffectivePaymentStatus(invoice),
    paymentId: latest?.id ?? null,
    gatewayStatus: latest?.gatewayStatus ?? null,
  };
}

function resolveEffectivePaymentStatus(invoice: {
  status: string;
  payment: Array<{ gatewayStatus: string | null }>;
}) {
  if (invoice.status === "PAID" || invoice.payment.length === 0) {
    return invoice.status;
  }
  const latest = invoice.payment[0];
  // Aplikasi mobile sudah menangani EXPIRED (muat ulang tanpa pesan "ditolak
  // admin" yang dipakainya untuk FAILED).
  if (latest.gatewayStatus === "EXPIRED") return "EXPIRED";
  const isFailedStatus =
    latest.gatewayStatus === "FAILED" || latest.gatewayStatus === "CANCELLED";
  return isFailedStatus ? "FAILED" : invoice.status;
}
