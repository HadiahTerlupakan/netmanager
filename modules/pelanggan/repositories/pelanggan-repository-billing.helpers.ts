import { InvoiceStatus } from "@prisma/client-billing";
import { prismaBilling } from "@/lib/prisma-billing";

/** Get payment history with pagination. */
export async function getPaymentHistory(
  pelangganId: string,
  options: { page: number; limit: number },
) {
  const { page, limit } = options;
  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    prismaBilling.payment.findMany({
      where: { pelangganId },
      orderBy: { paymentDate: "desc" },
      skip,
      take: limit,
      include: { invoice: { select: { invoiceNumber: true, status: true } } },
    }),
    prismaBilling.payment.count({ where: { pelangganId } }),
  ]);
  return { payments, total };
}

/** Get invoices by IDs for payment validation. */
export function getInvoicesByIds(
  ids: string[],
  pelangganId: string,
  validStatuses: string[],
) {
  return prismaBilling.invoice.findMany({
    where: {
      id: { in: ids },
      pelangganId,
      status: { in: parseInvoiceStatuses(validStatuses) },
    },
  });
}

/** Validasi dan konversi status invoice dari query string ke enum Prisma. */
export function parseInvoiceStatuses(statuses: string[]): InvoiceStatus[] {
  return statuses.map(parseInvoiceStatus);
}

function parseInvoiceStatus(status: string): InvoiceStatus {
  if (Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
    return status as InvoiceStatus;
  }

  throw new Error(`Invalid invoice status: ${status}`);
}
