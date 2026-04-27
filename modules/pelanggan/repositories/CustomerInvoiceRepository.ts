import { Prisma as PrismaBilling, InvoiceStatus } from "@prisma/client-billing";
import { prismaBilling } from "@/lib/prisma-billing";

/**
 * Type for invoice with its relations used in this repository
 */
type InvoiceWithRelations = PrismaBilling.InvoiceGetPayload<{
  include: {
    invoiceItem: true;
    payment: true;
  };
}>;

const UNPAID_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.PARTIAL_PAID,
];

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
      status?: string;
    },
  ) {
    const { page, limit, status } = options;
    const skip = (page - 1) * limit;

    const where: PrismaBilling.InvoiceWhereInput = { pelangganId };
    if (status) {
      where.status = status as InvoiceStatus;
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
    return invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      subtotal: Number(inv.subtotal),
      taxAmount: Number(inv.taxAmount),
      discountAmount: Number(inv.discountAmount),
      totalAmount: Number(inv.totalAmount),
      paidAmount: Number(inv.paidAmount),
      remainingAmount: Number(inv.totalAmount) - Number(inv.paidAmount),
      items: inv.invoiceItem.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      lastPayment: inv.payment[0]
        ? {
            amount: Number(inv.payment[0].amount),
            date: inv.payment[0].paymentDate,
            method: inv.payment[0].paymentMethod,
            accountId: inv.payment[0].accountId,
            gatewayStatus: inv.payment[0].gatewayStatus,
            expiresAt: inv.payment[0].expiresAt,
            paymentUrl: inv.payment[0].paymentUrl,
            receiptUrl: inv.payment[0].receiptUrl,
          }
        : null,
    }));
  }
}
