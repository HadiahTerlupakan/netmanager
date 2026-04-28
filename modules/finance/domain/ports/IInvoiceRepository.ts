import type { InvoiceEntity } from "../entities/InvoiceEntity";

export type InvoiceWhereInput = Record<string, unknown>;
export type InvoiceSelectInput = Record<string, unknown>;
export type InvoiceCreateInput = Record<string, unknown>;
export type InvoiceUpdateInput = Record<string, unknown>;
export type PaymentCreateInput = Record<string, unknown>;

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
    where: InvoiceWhereInput,
    select?: InvoiceSelectInput,
  ): Promise<unknown[]>;
  findPaginatedWithItemsAndPayments(options: {
    where: InvoiceWhereInput;
    page: number;
    limit: number;
  }): Promise<{ data: InvoiceEntity[]; total: number }>;
  count(where: InvoiceWhereInput): Promise<number>;
  countByMonth(date: Date): Promise<number>;
  update(id: string, data: InvoiceUpdateInput): Promise<InvoiceEntity>;
  updatePaymentStatus(
    id: string,
    data: InvoiceUpdateInput,
  ): Promise<InvoiceEntity>;
  markAsSent(id: string): Promise<InvoiceEntity>;
  updateWithItemsTransaction(options: {
    invoiceId: string;
    updateData: InvoiceUpdateInput;
    invoiceItem?: Array<{
      id?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }): Promise<InvoiceEntity>;
  deleteById(id: string): Promise<InvoiceEntity>;
  create(data: InvoiceCreateInput): Promise<InvoiceEntity>;
  createWithItems(data: InvoiceCreateInput): Promise<InvoiceEntity>;
  createPayment(data: PaymentCreateInput): Promise<unknown>;
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
    where: InvoiceWhereInput,
    select?: InvoiceSelectInput,
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
