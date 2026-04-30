import { prisma } from "@/lib/prisma";
import { prismaBilling } from "@/lib/prisma-billing";
import type { Invoice, Payment, Prisma } from "@prisma/client-billing";
import { getFinanceTenantWhere } from "./shared/financeMutationRepository";

export type InvoiceWithPayments = Invoice & { payment: Payment[] };

const DEFAULT_TOP_CUSTOMER_LIMIT = 10;
const PAYMENT_AMOUNT_DIVISOR = 100;
const UNKNOWN_CUSTOMER_NAME = "Unknown";

/** Repository untuk akses data analitik billing. */
export class BillingAnalyticsRepository {
  /** Mengambil filter tenant untuk invoice analytics. */
  private async getTenantWhere(): Promise<Prisma.InvoiceWhereInput> {
    return getFinanceTenantWhere();
  }

  /** Mengambil pembayaran tenant untuk rentang tanggal. */
  private async getGroupedCustomerPayments(
    dateStart: Date,
    dateEnd: Date,
    limit: number,
  ) {
    return prismaBilling.payment.groupBy({
      by: ["pelangganId"],
      where: {
        ...((await this.getTenantWhere()) as Prisma.PaymentWhereInput),
        paymentDate: { gte: dateStart, lte: dateEnd },
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "desc" } },
      take: limit,
    });
  }

  /** Mengambil map nama pelanggan berdasarkan daftar id. */
  private async getCustomerNameMap(customerIds: string[]) {
    const customers = await prisma.pelanggan.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, nama: true },
    });

    return new Map(customers.map((customer) => [customer.id, customer.nama]));
  }

  /** Mengambil invoice beserta pembayaran untuk rentang tanggal. */
  async getInvoicesWithPayments(
    dateStart: Date,
    dateEnd: Date,
  ): Promise<InvoiceWithPayments[]> {
    return prismaBilling.invoice.findMany({
      where: {
        ...(await this.getTenantWhere()),
        createdAt: { gte: dateStart, lte: dateEnd },
      },
      include: { payment: true },
    }) as Promise<InvoiceWithPayments[]>;
  }

  /** Mengambil seluruh pembayaran untuk rentang tanggal. */
  async getPayments(dateStart: Date, dateEnd: Date) {
    return prismaBilling.payment.findMany({
      where: {
        ...((await this.getTenantWhere()) as Prisma.PaymentWhereInput),
        paymentDate: { gte: dateStart, lte: dateEnd },
      },
    });
  }

  /** Mengambil invoice yang dibuat pada bulan tertentu. */
  async getInvoicesForMonth(monthStart: Date, monthEnd: Date) {
    return prismaBilling.invoice.findMany({
      where: {
        ...(await this.getTenantWhere()),
        createdAt: { gte: monthStart, lt: monthEnd },
      },
    });
  }

  /** Mengambil pelanggan teratas berdasarkan total pembayaran. */
  async getTopCustomersByPayment(
    dateStart: Date,
    dateEnd: Date,
    limit: number = DEFAULT_TOP_CUSTOMER_LIMIT,
  ) {
    const customerPayments = await this.getGroupedCustomerPayments(
      dateStart,
      dateEnd,
      limit,
    );
    const customerNameMap = await this.getCustomerNameMap(
      customerPayments.map((payment) => payment.pelangganId),
    );

    return customerPayments.map((payment) => ({
      id: payment.pelangganId,
      name: customerNameMap.get(payment.pelangganId) || UNKNOWN_CUSTOMER_NAME,
      totalPaid: Number(payment._sum.amount) / PAYMENT_AMOUNT_DIVISOR,
      invoiceCount: payment._count.id,
    }));
  }
}
