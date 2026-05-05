import { prismaBilling } from "@/lib/prisma-billing";
import type { Prisma } from "@prisma/client-billing";
import type {
  IInvoiceRepository,
  InvoiceWithPayment,
} from "../domain/ports/IInvoiceRepository";
import type { InvoiceEntity } from "../domain/entities/InvoiceEntity";
import {
  createInvoice,
  createInvoicePayment,
  createInvoiceWithItems,
  updateInvoiceWithItemsTransaction,
  voidInvoiceTransaction,
} from "./invoiceRepository.write";
import {
  findAuthInvoiceEntity,
  findAuthInvoiceWithPaymentEntity,
  findInvoiceEntitiesForExactDueDate,
  findInvoiceEntityById,
  findInvoiceWithItemsAndPaymentsBySiteEntity,
  findInvoiceWithItemsAndPaymentsEntity,
  findInvoiceWithItemsEntity,
  findInvoiceWithPaymentEntity,
  findOverdueInvoiceEntities,
  findPaginatedInvoicesWithItemsAndPayments,
} from "./invoiceRepository.read";
import { mapInvoiceEntity } from "./shared/invoiceRepositoryMappers";

export class InvoiceRepository implements IInvoiceRepository {
  /** Mengambil invoice beserta pembayaran sebagai entity domain. */
  async findUnique(id: string): Promise<InvoiceWithPayment | null> {
    return findInvoiceWithPaymentEntity(id);
  }

  /** Mengambil invoice mentah yang dipetakan ke entity domain sederhana. */
  async findRawById(id: string): Promise<InvoiceEntity | null> {
    return findInvoiceEntityById(id);
  }

  /** Mengambil invoice beserta pembayaran sebagai entity domain. */
  async findWithPayment(id: string): Promise<InvoiceWithPayment | null> {
    return findInvoiceWithPaymentEntity(id);
  }

  /** Mengambil invoice beserta item dan pembayaran sebagai entity domain. */
  async findWithItemsAndPayments(id: string): Promise<InvoiceEntity | null> {
    return findInvoiceWithItemsAndPaymentsEntity(id);
  }

  /** Mengambil invoice siap kirim sebagai entity domain. */
  async findInvoiceForSend(id: string): Promise<InvoiceEntity | null> {
    return findInvoiceWithItemsEntity(id);
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
    return findInvoiceWithItemsAndPaymentsBySiteEntity(id, siteId);
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
    return findPaginatedInvoicesWithItemsAndPayments(options);
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
    return updateInvoiceWithItemsTransaction(options);
  }

  /** Menghapus invoice dan mengembalikan entity domain. */
  async deleteById(id: string): Promise<InvoiceEntity> {
    const invoice = await prismaBilling.invoice.delete({ where: { id } });
    return mapInvoiceEntity(invoice) as InvoiceEntity;
  }

  /** Membuat invoice baru. */
  async create(data: Prisma.InvoiceCreateInput): Promise<InvoiceEntity> {
    return createInvoice(data);
  }

  /** Membuat invoice baru beserta item dan pembayaran. */
  async createWithItems(
    data: Prisma.InvoiceCreateInput,
  ): Promise<InvoiceEntity> {
    return createInvoiceWithItems(data);
  }

  /** Membuat payment terkait invoice. */
  async createPayment(data: Prisma.PaymentCreateInput) {
    return createInvoicePayment(data);
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
    return findInvoiceEntitiesForExactDueDate(
      pelangganId,
      dueDateStart,
      dueDateEnd,
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
    return findOverdueInvoiceEntities(beforeDate);
  }

  /** Menjalankan void invoice dan sinkronisasi status payment. */
  async voidInvoiceTransaction(
    invoiceId: string,
    reason: string,
    invoiceNotes: string | null,
  ) {
    return voidInvoiceTransaction(invoiceId, reason, invoiceNotes);
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
    return findAuthInvoiceWithPaymentEntity(id);
  }

  /** Mengambil invoice auth sederhana untuk side effect pasca bayar. */
  async findUniqueAuth(id: string): Promise<InvoiceEntity | null> {
    return findAuthInvoiceEntity(id);
  }
}
