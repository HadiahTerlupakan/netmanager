export interface PurchaseOrderItemDTO {
  id: string;
  barangId: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  tenantId: string | null;
}

export interface PurchaseOrderDTO {
  id: string;
  poNumber: string;
  supplierId: string | null;
  status: string;
  totalAmount: number;
  issuedAt: Date | null;
  expectedDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  processedById: string | null;
  receivedById: string | null;
  fotoBukti: string[];
  grandTotal: number;
  paidFromAccountId: string | null;
  paymentStatus: string;
  ppnAmount: number;
  ppnRate: number;
  tenantId: string | null;
  items?: PurchaseOrderItemDTO[];
}
