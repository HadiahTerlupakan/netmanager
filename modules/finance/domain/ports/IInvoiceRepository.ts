import type { Prisma } from "@prisma/client-billing";
import type { InvoiceEntity } from "../entities/InvoiceEntity";

export type InvoiceWithPayment = InvoiceEntity & {
  payment: NonNullable<InvoiceEntity["payment"]>;
};
export type InvoiceWithItems = InvoiceEntity & {
  invoiceItem: NonNullable<InvoiceEntity["invoiceItem"]>;
};

/** Repository port for finance invoice persistence. */
export interface IInvoiceRepository {
  findUnique(id: string): Promise<InvoiceWithPayment | null>;
  findRawById(id: string): Promise<InvoiceEntity | null>;
  findWithPayment(id: string): Promise<InvoiceWithPayment | null>;
  findWithItemsAndPayments(id: string): Promise<InvoiceEntity | null>;
  findInvoiceForSend(id: string): Promise<InvoiceEntity | null>;
  findCustomerPaymentStatus(options: {
    invoiceId: string;
    pelangganId: string;
  }): Promise<{
    status: string;
    id: string;
    payment: Array<{ gatewayStatus?: string | null; id: string }>;
  } | null>;
  findWithItemsAndPaymentsBySite(
    id: string,
    siteId: string,
  ): Promise<InvoiceEntity | null>;
  findMany(
    where: Prisma.InvoiceWhereInput,
    select?: Prisma.InvoiceSelect,
  ): Promise<unknown[]>;
  findPaginatedWithItemsAndPayments(options: {
    where: Prisma.InvoiceWhereInput;
    page: number;
    limit: number;
  }): Promise<{ data: InvoiceEntity[]; total: number }>;
  count(where: Prisma.InvoiceWhereInput): Promise<number>;
  countByMonth(date: Date): Promise<number>;
  update(id: string, data: Prisma.InvoiceUpdateInput): Promise<InvoiceEntity>;
  updatePaymentStatus(
    id: string,
    data: Prisma.InvoiceUpdateInput,
  ): Promise<InvoiceEntity>;
  markAsSent(id: string): Promise<InvoiceEntity>;
  updateWithItemsTransaction(options: {
    invoiceId: string;
    updateData: Prisma.InvoiceUpdateInput;
    invoiceItem?: Array<{
      id?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }): Promise<InvoiceEntity>;
  deleteById(id: string): Promise<InvoiceEntity>;
  create(data: Prisma.InvoiceCreateInput): Promise<InvoiceEntity>;
  createWithItems(data: Prisma.InvoiceCreateInput): Promise<InvoiceEntity>;
  createPayment(data: Prisma.PaymentCreateInput): Promise<unknown>;
  findManyForDateRange(
    dueDateStart: Date,
    dueDateEnd: Date,
    pelangganIds?: string[],
  ): Promise<Array<{ pelangganId: string | null }>>;
  findManyForExactDueDate(
    pelangganId: string,
    dueDateStart: Date,
    dueDateEnd: Date,
  ): Promise<InvoiceEntity[]>;
  findManyForDateRangeWithPelangganIds(
    dueDateStart: Date,
    dueDateEnd: Date,
    pelangganIds: string[],
  ): Promise<Array<{ pelangganId: string | null }>>;
  findUnpaidInvoices(
    where: Prisma.InvoiceWhereInput,
    select?: Prisma.InvoiceSelect,
  ): Promise<unknown[]>;
  findOverdueInvoices(beforeDate: Date): Promise<InvoiceEntity[]>;
  voidInvoiceTransaction(
    invoiceId: string,
    reason: string,
    invoiceNotes: string | null,
  ): Promise<void>;
  countUnpaidByPelangganId(pelangganId: string): Promise<number>;
  findUniqueAuthWithPayment(id: string): Promise<InvoiceWithPayment | null>;
  findUniqueAuth(id: string): Promise<InvoiceEntity | null>;
}
