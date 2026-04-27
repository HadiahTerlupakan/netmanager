export interface InvoiceCustomerEntity {
  id: string;
  idPelanggan?: string;
  nama?: string;
  alamat?: string | null;
  noTelp?: string | null;
  email?: string | null;
}

export interface InvoiceItemEntity {
  id: string;
  description: string;
  quantity: number;
  unitPrice: bigint;
  totalPrice: bigint;
  itemType?: string | null;
}

export interface InvoicePaymentEntity {
  id: string;
  amount: bigint;
  paymentDate: Date;
  paymentMethod?: string | null;
  reference?: string | null;
  gatewayStatus?: string | null;
  verifiedAt?: Date | null;
}

/** Pure domain entity for finance invoice aggregates. */
export interface InvoiceEntity {
  id: string;
  invoiceNumber?: string;
  pelangganId: string | null;
  siteId?: string | null;
  issueDate?: Date | null;
  dueDate: Date;
  subtotal: bigint;
  taxAmount: bigint;
  discountAmount: bigint;
  totalAmount: bigint;
  paidAmount: bigint;
  status: string;
  notes?: string | null;
  terms?: string | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date | null;
  paidAt?: Date | null;
  pelanggan?: InvoiceCustomerEntity | null;
  invoiceItem?: InvoiceItemEntity[];
  items?: InvoiceItemEntity[];
  payment?: InvoicePaymentEntity[];
  payments?: InvoicePaymentEntity[];
}
