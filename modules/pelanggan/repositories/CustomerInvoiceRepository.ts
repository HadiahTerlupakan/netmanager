import { Prisma as PrismaBilling, InvoiceStatus } from "@prisma/client-billing";
import { prismaBilling } from "@/lib/prisma-billing";
import { OUTSTANDING_INVOICE_STATUSES } from "@/lib/constants/invoice-status";
import { parseInvoiceStatuses } from "./pelanggan-repository-billing.helpers";

/**
 * Type for invoice with its relations used in this repository
 */
type InvoiceWithRelations = PrismaBilling.InvoiceGetPayload<{
  include: {
    invoiceItem: true;
    payment: true;
  };
}>;

const UNPAID_INVOICE_STATUSES = [
  ...OUTSTANDING_INVOICE_STATUSES,
] as InvoiceStatus[];

export type CustomerDashboardBillingSummary = {
  outstandingCount: number;
  outstandingAmount: number;
  nearestDueDate: string | null;
  hasOverdue: boolean;
};

/**
 * Repository for customer invoice operations
 * Handles invoice queries with items, payment history, and dashboard summaries
 */
function formatInvoiceResponse(invoice: InvoiceWithRelations) {
  return {
    ...formatInvoiceIdentity(invoice),
    ...formatInvoiceAmounts(invoice),
    items: invoice.invoiceItem.map(formatInvoiceItem),
    lastPayment: formatLastPayment(invoice),
  };
}

function formatInvoiceIdentity(invoice: InvoiceWithRelations) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
  };
}

function formatInvoiceAmounts(invoice: InvoiceWithRelations) {
  const totalAmount = Number(invoice.totalAmount);
  const paidAmount = Number(invoice.paidAmount);
  return {
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    totalAmount,
    paidAmount,
    remainingAmount: totalAmount - paidAmount,
  };
}

function formatInvoiceItem(item: InvoiceWithRelations["invoiceItem"][number]) {
  return {
    description: item.description,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
  };
}

function formatLastPayment(invoice: InvoiceWithRelations) {
  const payment = invoice.payment[0];
  if (!payment) return null;
  return {
    amount: Number(payment.amount),
    date: payment.paymentDate,
    method: payment.paymentMethod,
    accountId: payment.accountId,
    gatewayStatus: payment.gatewayStatus,
    expiresAt: payment.expiresAt,
    paymentUrl: payment.paymentUrl,
    receiptUrl: payment.receiptUrl,
  };
}

export class CustomerInvoiceRepository {
  /** Get invoice records for legacy customer billing response. */
  async findLegacyTagihanByPelanggan(input: {
    pelangganId: string;
    tenantId?: string | null;
  }) {
    return prismaBilling.invoice.findMany({
      where: {
        pelangganId: input.pelangganId,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
        status: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
        payment: {
          select: { paymentMethod: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get invoices with pagination and optional status filter
   * Includes invoice items and last payment
   */
  async findAllForCustomer(
    pelangganId: string,
    options: {
      page: number;
      limit: number;
      status?: string[];
    },
  ) {
    const { page, limit, status } = options;
    const skip = (page - 1) * limit;

    const where: PrismaBilling.InvoiceWhereInput = { pelangganId };
    if (status && status.length > 0) {
      where.status = { in: parseInvoiceStatuses(status) };
    }

    const [invoices, total] = await Promise.all([
      prismaBilling.invoice.findMany({
        where,
        orderBy: { issueDate: "desc" },
        skip,
        take: limit,
        include: {
          invoiceItem: true,
          payment: {
            orderBy: { paymentDate: "desc" },
            take: 1,
          },
        },
      }),
      prismaBilling.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  /**
   * Get billing summary data for the customer dashboard
   */
  async getDashboardBillingSummary(pelangganId: string) {
    const invoices = await prismaBilling.invoice.findMany({
      where: {
        pelangganId,
        status: { in: UNPAID_INVOICE_STATUSES },
      },
      orderBy: { dueDate: "asc" },
      select: {
        status: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
      },
    });

    const outstandingAmount = invoices.reduce((total, invoice) => {
      return total + (Number(invoice.totalAmount) - Number(invoice.paidAmount));
    }, 0);

    return {
      outstandingCount: invoices.length,
      outstandingAmount,
      nearestDueDate: invoices[0]?.dueDate.toISOString() ?? null,
      hasOverdue: invoices.some(
        (invoice) => invoice.status === InvoiceStatus.OVERDUE,
      ),
    };
  }

  /**
   * Format invoices for API response
   */
  formatInvoicesForResponse(invoices: InvoiceWithRelations[]) {
    return invoices.map(formatInvoiceResponse);
  }
}
