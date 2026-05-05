import { InvoiceStatus, Prisma as PrismaBilling } from "@prisma/client-billing";
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

/** Get invoices with pagination. */
export async function getInvoices(
  pelangganId: string,
  options: { page: number; limit: number; status?: string[] },
) {
  const { page, limit } = options;
  const where = buildInvoiceWhere(pelangganId, options.status);
  const [invoices, total] = await Promise.all([
    prismaBilling.invoice.findMany({
      where,
      orderBy: { dueDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prismaBilling.invoice.count({ where }),
  ]);
  return { invoices, total };
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

function buildInvoiceWhere(pelangganId: string, status?: string[]) {
  const where: PrismaBilling.InvoiceWhereInput = { pelangganId };
  if (status && status.length > 0) {
    where.status = { in: parseInvoiceStatuses(status) };
  }
  return where;
}

function parseInvoiceStatuses(statuses: string[]): InvoiceStatus[] {
  return statuses.map(parseInvoiceStatus);
}

function parseInvoiceStatus(status: string): InvoiceStatus {
  if (Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
    return status as InvoiceStatus;
  }

  throw new Error(`Invalid invoice status: ${status}`);
}
