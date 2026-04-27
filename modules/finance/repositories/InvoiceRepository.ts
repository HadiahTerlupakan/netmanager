import { randomUUID } from "crypto";
import { prismaBilling, prismaBillingAuth } from "@/lib/prisma-billing";
import type { Prisma } from "@prisma/client-billing";
import { InvoiceMapper } from "../mappers/InvoiceMapper";
import type {
  IInvoiceRepository,
  InvoiceWithPayment,
} from "../domain/ports/IInvoiceRepository";
import type { InvoiceEntity } from "../domain/entities/InvoiceEntity";

export class InvoiceRepository implements IInvoiceRepository {
  /** Mengambil invoice beserta pembayaran sebagai entity domain. */
  async findUnique(id: string): Promise<InvoiceWithPayment | null> {
    const invoice = await prismaBilling.invoice.findUnique({
      where: { id },
      include: { payment: true },
    });
    return mapInvoiceWithPayment(invoice);
  }

  /** Mengambil invoice mentah yang dipetakan ke entity domain sederhana. */
  async findRawById(id: string): Promise<InvoiceEntity | null> {
    const invoice = await prismaBilling.invoice.findUnique({ where: { id } });
    return mapInvoiceEntity(invoice);
  }

  /** Mengambil invoice beserta pembayaran sebagai entity domain. */
  async findWithPayment(id: string): Promise<InvoiceWithPayment | null> {
    const invoice = await prismaBilling.invoice.findUnique({
      where: { id },
      include: { payment: true },
    });
    return mapInvoiceWithPayment(invoice);
  }

  /** Mengambil invoice beserta item dan pembayaran sebagai entity domain. */
  async findWithItemsAndPayments(id: string): Promise<InvoiceEntity | null> {
    const invoice = await prismaBilling.invoice.findUnique({
      where: { id },
      include: {
        invoiceItem: true,
        payment: true,
      },
    });
    return mapInvoiceWithItemsAndPayments(invoice);
  }

  /** Mengambil invoice siap kirim sebagai entity domain. */
  async findInvoiceForSend(id: string): Promise<InvoiceEntity | null> {
    const invoice = await prismaBilling.invoice.findUnique({
      where: { id },
      include: { invoiceItem: true },
    });
    return mapInvoiceWithItems(invoice);
  }

  async findCustomerPaymentStatus(options: {
    invoiceId: string;
    pelangganId: string;
  }) {
    return prismaBilling.invoice.findUnique({
      where: {
        id: options.invoiceId,
        pelangganId: options.pelangganId,
      },
      select: {
        status: true,
        id: true,
        payment: {
          orderBy: { paymentDate: "desc" },
          take: 1,
          select: { gatewayStatus: true, id: true },
        },
      },
    });
  }

  /** Mengambil invoice per site beserta item dan pembayaran. */
  async findWithItemsAndPaymentsBySite(
    id: string,
    siteId: string,
  ): Promise<InvoiceEntity | null> {
    const invoice = await prismaBilling.invoice.findFirst({
      where: { id, siteId },
      include: {
        invoiceItem: true,
        payment: true,
      },
    });
    return mapInvoiceWithItemsAndPayments(invoice);
  }

  async findMany(
    where: Prisma.InvoiceWhereInput,
    select?: Prisma.InvoiceSelect,
  ) {
    return prismaBilling.invoice.findMany({
      where,
      ...(select ? { select } : {}),
    });
  }

  /** Mengambil daftar invoice terpaging sebagai entity domain. */
  async findPaginatedWithItemsAndPayments(options: {
    where: Prisma.InvoiceWhereInput;
    page: number;
    limit: number;
  }): Promise<{ data: InvoiceEntity[]; total: number }> {
    const skip = (options.page - 1) * options.limit;
    const [data, total] = await Promise.all([
      prismaBilling.invoice.findMany({
        where: options.where,
        include: {
          invoiceItem: true,
          payment: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: options.limit,
      }),
      prismaBilling.invoice.count({ where: options.where }),
    ]);

    return {
      data: data.map(
        (invoice) => mapInvoiceWithItemsAndPayments(invoice) as InvoiceEntity,
      ),
      total,
    };
  }

  async count(where: Prisma.InvoiceWhereInput) {
    return prismaBilling.invoice.count({ where });
  }

  async countByMonth(date: Date) {
    return prismaBilling.invoice.count({
      where: {
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), 1),
          lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
        },
      },
    });
  }

  /** Memperbarui invoice dan mengembalikan entity domain. */
  async update(
    id: string,
    data: Prisma.InvoiceUpdateInput,
  ): Promise<InvoiceEntity> {
    const invoice = await prismaBilling.invoice.update({
      where: { id },
      data,
    });
    return mapInvoiceEntity(invoice) as InvoiceEntity;
  }

  /** Memperbarui status pembayaran invoice. */
  async updatePaymentStatus(
    id: string,
    data: Prisma.InvoiceUpdateInput,
  ): Promise<InvoiceEntity> {
    const invoice = await prismaBilling.invoice.update({ where: { id }, data });
    return mapInvoiceEntity(invoice) as InvoiceEntity;
  }

  /** Menandai invoice sebagai terkirim. */
  async markAsSent(id: string): Promise<InvoiceEntity> {
    const invoice = await prismaBilling.invoice.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });
    return mapInvoiceEntity(invoice) as InvoiceEntity;
  }

  /** Memperbarui invoice dan item terkait dalam satu transaksi. */
  async updateWithItemsTransaction(options: {
    invoiceId: string;
    updateData: Prisma.InvoiceUpdateInput;
    invoiceItem?: Array<{
      id?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }): Promise<InvoiceEntity> {
    const invoice = await prismaBilling.$transaction(async (tx) => {
      if (options.invoiceItem && options.invoiceItem.length > 0) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: options.invoiceId },
        });

        await tx.invoiceItem.createMany({
          data: options.invoiceItem.map((item) => ({
            id: item.id || randomUUID(),
            invoiceId: options.invoiceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: BigInt(item.unitPrice),
            totalPrice: BigInt(item.totalPrice),
          })),
        });
      }

      return tx.invoice.update({
        where: { id: options.invoiceId },
        data: options.updateData,
        include: {
          invoiceItem: true,
          payment: true,
        },
      });
    });
    return mapInvoiceWithItemsAndPayments(invoice) as InvoiceEntity;
  }

  /** Menghapus invoice dan mengembalikan entity domain. */
  async deleteById(id: string): Promise<InvoiceEntity> {
    const invoice = await prismaBilling.invoice.delete({ where: { id } });
    return mapInvoiceEntity(invoice) as InvoiceEntity;
  }

  /** Membuat invoice baru. */
  async create(data: Prisma.InvoiceCreateInput): Promise<InvoiceEntity> {
    const invoice = await prismaBilling.invoice.create({ data });
    return mapInvoiceEntity(invoice) as InvoiceEntity;
  }

  /** Membuat invoice baru beserta item dan pembayaran. */
  async createWithItems(
    data: Prisma.InvoiceCreateInput,
  ): Promise<InvoiceEntity> {
    const invoice = await prismaBilling.invoice.create({
      data,
      include: {
        invoiceItem: true,
        payment: true,
      },
    });
    return mapInvoiceWithItemsAndPayments(invoice) as InvoiceEntity;
  }

  async createPayment(data: Prisma.PaymentCreateInput) {
    return prismaBilling.payment.create({ data });
  }

  async findManyForDateRange(
    dueDateStart: Date,
    dueDateEnd: Date,
    pelangganIds?: string[],
  ) {
    const where: Prisma.InvoiceWhereInput = {
      dueDate: { gte: dueDateStart, lte: dueDateEnd },
    };
    if (pelangganIds) {
      where.pelangganId = { in: pelangganIds };
    }
    return prismaBilling.invoice.findMany({
      where,
      select: { pelangganId: true },
    });
  }

  /** Mengambil invoice pelanggan pada tanggal jatuh tempo persis. */
  async findManyForExactDueDate(
    pelangganId: string,
    dueDateStart: Date,
    dueDateEnd: Date,
  ): Promise<InvoiceEntity[]> {
    const invoices = await prismaBilling.invoice.findMany({
      where: {
        pelangganId,
        dueDate: { gte: dueDateStart, lte: dueDateEnd },
      },
    });
    return invoices.map(
      (invoice) => mapInvoiceEntity(invoice) as InvoiceEntity,
    );
  }

  async findManyForDateRangeWithPelangganIds(
    dueDateStart: Date,
    dueDateEnd: Date,
    pelangganIds: string[],
  ) {
    return prismaBilling.invoice.findMany({
      where: {
        pelangganId: { in: pelangganIds },
        dueDate: { gte: dueDateStart, lte: dueDateEnd },
      },
      select: { pelangganId: true },
    });
  }

  async findUnpaidInvoices(
    where: Prisma.InvoiceWhereInput,
    select?: Prisma.InvoiceSelect,
  ) {
    return prismaBilling.invoice.findMany({
      where,
      ...(select ? { select } : {}),
    });
  }

  /** Mengambil invoice overdue sebagai entity domain. */
  async findOverdueInvoices(beforeDate: Date): Promise<InvoiceEntity[]> {
    const invoices = await prismaBilling.invoice.findMany({
      where: {
        status: "OVERDUE",
        dueDate: { lt: beforeDate },
      },
    });
    return invoices.map(
      (invoice) => mapInvoiceEntity(invoice) as InvoiceEntity,
    );
  }

  async voidInvoiceTransaction(
    invoiceId: string,
    reason: string,
    invoiceNotes: string | null,
  ) {
    return prismaBilling.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { invoiceId, gatewayStatus: "PAID" },
        data: { gatewayStatus: "REFUNDED" },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "CANCELLED",
          paidAmount: 0,
          notes: invoiceNotes
            ? `${invoiceNotes}\n[VOID] Reason: ${reason}`
            : `[VOID] Reason: ${reason}`,
        },
      });
    });
  }

  async countUnpaidByPelangganId(pelangganId: string) {
    return prismaBilling.invoice.count({
      where: {
        pelangganId,
        status: { notIn: ["PAID", "CANCELLED"] },
      },
    });
  }

  /** Mengambil invoice auth beserta pembayaran terkait untuk rekonsiliasi webhook. */
  async findUniqueAuthWithPayment(
    id: string,
  ): Promise<InvoiceWithPayment | null> {
    const invoice = await prismaBillingAuth.invoice.findUnique({
      where: { id },
      include: { payment: true },
    });
    return mapInvoiceWithPayment(invoice);
  }

  /** Mengambil invoice auth sederhana untuk side effect pasca bayar. */
  async findUniqueAuth(id: string): Promise<InvoiceEntity | null> {
    const invoice = await prismaBillingAuth.invoice.findUnique({
      where: { id },
    });
    return mapInvoiceEntity(invoice);
  }
}

function mapInvoiceEntity(invoice: unknown) {
  if (!invoice) {
    return null;
  }

  return InvoiceMapper.toDomain(invoice as never);
}

function mapInvoiceWithItems(invoice: unknown) {
  if (!invoice) {
    return null;
  }

  const source = invoice as Record<string, unknown>;
  return InvoiceMapper.toDomain({
    ...source,
    items: source.invoiceItem,
    payments: [],
  } as never);
}

function mapInvoiceWithPayment(invoice: unknown) {
  if (!invoice) {
    return null;
  }

  const source = invoice as Record<string, unknown>;
  return InvoiceMapper.toDomain({
    ...source,
    items: [],
    payments: source.payment,
  } as never) as InvoiceWithPayment;
}

function mapInvoiceWithItemsAndPayments(invoice: unknown) {
  if (!invoice) {
    return null;
  }

  const source = invoice as Record<string, unknown>;
  return InvoiceMapper.toDomain({
    ...source,
    items: source.invoiceItem,
    payments: source.payment,
  } as never);
}
