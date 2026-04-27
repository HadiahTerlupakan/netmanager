import type { InvoiceEntity } from "./InvoiceEntity";

/** Pure domain entity for finance payment aggregates. */
export interface PaymentEntity {
  id: string;
  invoiceId?: string | null;
  pelangganId: string;
  tenantId?: string | null;
  amount: bigint;
  paymentDate: Date;
  paymentMethod?: string | null;
  gatewayStatus?: string | null;
  reference?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
  transactionId?: string | null;
  paymentUrl?: string | null;
  expiresAt?: Date | null;
  gatewayProvider?: string | null;
  verifiedAt?: Date | null;
  invoice?: InvoiceEntity | null;
}
