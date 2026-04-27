import type { PurchaseOrderEntity } from "../entities/PurchaseOrder";
import type { PurchaseRequestEntity } from "../entities/PurchaseRequest";

export interface CreatePurchaseOrderItemInput {
  id: string;
  barangId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  tenantId: string | null;
}

export interface CreatePurchaseOrderInput {
  id: string;
  poNumber: string;
  supplierId: string | null;
  createdBy: string;
  tenantId: string | null;
  totalAmount: number;
  items: CreatePurchaseOrderItemInput[];
  prIds: string[];
}

export interface IProcurementRepository {
  /** Mengambil purchase request APPROVED yang masih eligible untuk dibuatkan PO. */
  findApprovedPRs(prIds: string[]): Promise<PurchaseRequestEntity[]>;

  /** Mengambil purchase order terakhir berdasarkan prefix nomor PO. */
  findLastPOByNumberPrefix(
    prefix: string,
    tenantId?: string | null,
  ): Promise<PurchaseOrderEntity | null>;

  /** Membuat purchase order beserta item dan menghubungkan purchase request terkait. */
  createPOWithItems(
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderEntity>;

  /** Membuat nomor purchase order baru berdasarkan tenant dan periode aktif. */
  generatePONumber(tenantId?: string | null): Promise<string>;
}
