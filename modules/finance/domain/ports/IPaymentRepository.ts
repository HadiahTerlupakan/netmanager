import type { PaymentEntity } from "../entities/PaymentEntity";

export type PaymentWhereInput = Record<string, unknown>;
export type PaymentSelectInput = Record<string, unknown>;
export type PaymentCreateInput = Record<string, unknown>;
export type PaymentUpdateManyInput = Record<string, unknown>;

/** Repository port for finance payment persistence. */
export interface IPaymentRepository {
  findManyByDateRange(startDate: Date, endDate: Date): Promise<PaymentEntity[]>;
  findMany(
    where: PaymentWhereInput,
    select?: PaymentSelectInput,
  ): Promise<unknown[]>;
  findPendingManualTransfer(options: {
    invoiceId: string;
    pelangganId: string;
  }): Promise<PaymentEntity | null>;
  updateReceipt(options: {
    paymentId: string;
    receiptUrl: string;
    notes: string;
  }): Promise<PaymentEntity>;
  findByIdWithInvoice(id: string): Promise<PaymentEntity | null>;
  findPaginatedWithInvoice(options: {
    where: PaymentWhereInput;
    page: number;
    limit: number;
  }): Promise<{ data: PaymentEntity[]; total: number }>;
  count(where: PaymentWhereInput): Promise<number>;
  create(data: PaymentCreateInput): Promise<PaymentEntity>;
  createWithInvoice(data: PaymentCreateInput): Promise<PaymentEntity>;
  updateManyInTransaction(
    tx: unknown,
    where: PaymentWhereInput,
    data: PaymentUpdateManyInput,
  ): Promise<{ count: number }>;
  createCustomerPaymentsForInvoices(options: {
    customerId: string;
    tenantId?: string | null;
    invoiceIds: string[];
    discountAmount: number;
    paymentMethod: string;
    notes?: string | null;
    couponId?: string | null;
    couponService?: {
      recordUsage(
        couponId: string,
        customerId: string,
        tx: unknown,
      ): Promise<unknown>;
      incrementUsage(couponId: string, tx: unknown): Promise<unknown>;
    };
  }): Promise<PaymentEntity[]>;
  updateGatewayMetadata(options: {
    paymentIds: string[];
    tenantId?: string | null;
    transactionId?: string | null;
    paymentUrl?: string | null;
    expiresAt?: Date | null;
    gatewayProvider?: string | null;
  }): Promise<{ count: number }>;
  findFirstAuth(where: PaymentWhereInput): Promise<PaymentEntity | null>;
}
