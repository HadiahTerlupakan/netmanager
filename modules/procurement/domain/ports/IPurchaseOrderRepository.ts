import type {
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
} from "../entities/PurchaseOrder";

export type ProcurementPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface PurchaseOrderPaymentInput {
  poId: string;
  po: PurchaseOrderEntity;
  amount: number;
  date: Date;
  notes?: string;
  paidFromAccountId?: string;
}

export interface PurchaseOrderPaymentResult {
  expense: { id: string };
  newStatus: ProcurementPaymentStatus;
}

export interface PurchaseOrderListFilter {
  tenantId: string | null;
  search?: string;
  status?: string;
  paymentStatus?: ProcurementPaymentStatus;
  page: number;
  limit: number;
}

export interface PurchaseOrderSupplierSummary {
  id: string;
  name: string;
  npwp: string | null;
}

export interface PurchaseOrderItemBarangSummary {
  id: string;
  nama: string;
}

export interface PurchaseOrderItemWithBarang extends PurchaseOrderItemEntity {
  barang: PurchaseOrderItemBarangSummary | null;
}

export interface PurchaseOrderWithSupplier extends PurchaseOrderEntity {
  supplier: PurchaseOrderSupplierSummary | null;
}

export interface PurchaseOrderWithRelations extends PurchaseOrderWithSupplier {
  items: PurchaseOrderItemWithBarang[];
}

export interface PurchaseOrderListResult {
  items: PurchaseOrderWithSupplier[];
  total: number;
  page: number;
  limit: number;
}

export interface PurchaseOrderCreateInput {
  poNumber: string;
  supplierId: string | null;
  createdBy: string;
  tenantId: string | null;
  expectedDate?: Date | null;
  notes?: string | null;
  ppnRate?: number;
  vendorNpwp?: string | null;
  items: Array<{
    barangId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface PurchaseOrderMetadataUpdate {
  expectedDate?: Date | null;
  notes?: string | null;
  fakturPajakNo?: string | null;
  fakturPajakDate?: Date | null;
  vendorNpwp?: string | null;
}

export interface PurchaseOrderTaxFilter {
  tenantId?: string | null;
  ppnAmount?: { gt?: number; gte?: number; lt?: number; lte?: number };
  createdAt?: { gte?: Date; lte?: Date };
  fakturPajakDate?: { gte?: Date; lte?: Date };
  vendorNpwp?: { not: null } | string | null;
}

export interface PurchaseOrderTaxRecord {
  poNumber: string;
  ppnAmount: number;
  ppnRate: number;
  totalAmount: number;
  createdAt: Date;
  supplier: { name: string } | null;
}

export interface IPurchaseOrderRepository {
  findById(id: string): Promise<PurchaseOrderEntity | null>;

  findByIdWithRelations(id: string): Promise<PurchaseOrderWithRelations | null>;

  list(filter: PurchaseOrderListFilter): Promise<PurchaseOrderListResult>;

  update(
    id: string,
    data: {
      paymentStatus?: ProcurementPaymentStatus;
      paidFromAccountId?: string;
    },
  ): Promise<PurchaseOrderEntity>;

  updateMetadata(
    id: string,
    data: PurchaseOrderMetadataUpdate,
  ): Promise<PurchaseOrderEntity>;

  create(input: PurchaseOrderCreateInput): Promise<PurchaseOrderEntity>;

  delete(id: string): Promise<void>;

  generatePoNumber(tenantId: string | null): Promise<string>;

  findManyWithTax(
    filter: PurchaseOrderTaxFilter,
  ): Promise<PurchaseOrderTaxRecord[]>;

  processPaymentTransaction(
    input: PurchaseOrderPaymentInput,
  ): Promise<PurchaseOrderPaymentResult>;
}
