import { getCustomerInvoicePaymentStatus } from "@/modules/finance";

/** Returns customer invoice payment status for SSE polling. */
export function getCustomerPaymentStreamStatus(options: {
  invoiceId: string;
  customerId: string;
}) {
  return getCustomerInvoicePaymentStatus(options);
}
