import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";

type CustomerPaymentCouponService = {
  recordUsage(
    couponId: string,
    customerId: string,
    tx: unknown,
  ): Promise<unknown>;
  incrementUsage(couponId: string, tx: unknown): Promise<unknown>;
};

const paymentRepository = new PaymentRepository();
const invoiceRepository = new InvoiceRepository();

/** Creates pending customer payments for selected invoices. */
export function createCustomerPaymentsForInvoices(options: {
  customerId: string;
  tenantId?: string | null;
  invoiceIds: string[];
  discountAmount: number;
  paymentMethod: string;
  notes?: string | null;
  couponId?: string | null;
  couponService?: CustomerPaymentCouponService;
}) {
  return paymentRepository.createCustomerPaymentsForInvoices(options);
}

/** Stores payment gateway metadata on customer payments. */
export function updateCustomerPaymentGatewayMetadata(options: {
  paymentIds: string[];
  tenantId?: string | null;
  transactionId?: string | null;
  paymentUrl?: string | null;
  expiresAt?: Date | null;
  gatewayProvider?: string | null;
}) {
  return paymentRepository.updateGatewayMetadata(options);
}

/** Finds pending manual transfer payment for customer receipt upload. */
export function findPendingManualCustomerTransfer(options: {
  invoiceId: string;
  customerId: string;
}) {
  return paymentRepository.findPendingManualTransfer({
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
  return paymentRepository.updateReceipt(options);
}

/** Returns customer invoice status used by customer payment polling. */
export async function getCustomerInvoicePaymentStatus(options: {
  invoiceId: string;
  customerId: string;
}) {
  const invoice = await invoiceRepository.findCustomerPaymentStatus({
    invoiceId: options.invoiceId,
    pelangganId: options.customerId,
  });

  if (!invoice) {
    return null;
  }

  if (invoice.status !== "PAID" && invoice.payment.length > 0) {
    const latestPayment = invoice.payment[0];
    if (
      latestPayment.gatewayStatus === "FAILED" ||
      latestPayment.gatewayStatus === "CANCELLED"
    ) {
      return "FAILED";
    }
  }

  return invoice.status;
}
