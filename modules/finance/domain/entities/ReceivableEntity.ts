export interface ReceivablePaymentEntity {
  id: string;
  amount: bigint | number;
  [key: string]: unknown;
}

export interface ReceivableCustomerEntity {
  id: string;
  idPelanggan: string;
  nama: string;
}

export interface ReceivableEntity {
  id: string;
  invoiceNumber: string;
  pelangganId: string;
  pelanggan?: ReceivableCustomerEntity | null;
  status: string;
  totalAmount: bigint | number;
  paidAmount: bigint | number;
  subtotal: bigint | number;
  taxAmount: bigint | number;
  discountAmount: bigint | number;
  dueDate: Date | string;
  issueDate: Date | string;
  createdAt: Date;
  updatedAt: Date;
  notes?: string | null;
  payment?: ReceivablePaymentEntity[] | null;
  [key: string]: unknown;
}
