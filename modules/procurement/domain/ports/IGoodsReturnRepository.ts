import type {
  GoodsReturnEntity,
  GoodsReturnItemEntity,
  GoodsReturnReason,
  GoodsReturnStatus,
} from "../entities/GoodsReturn";

export interface GoodsReturnItemCreateInput {
  goodsReceiptItemId: string;
  barangId: string;
  quantity: number;
  notes?: string | null;
}

export interface GoodsReturnCreateInput {
  rtvNumber: string;
  goodsReceiptId: string;
  supplierId: string | null;
  gudangId: string;
  reason: GoodsReturnReason;
  returnedById: string;
  returnedAt?: Date;
  notes?: string | null;
  fotoBukti?: string[];
  tenantId: string | null;
  items: GoodsReturnItemCreateInput[];
}

export interface GoodsReturnResolveInput {
  status: Exclude<GoodsReturnStatus, "DRAFT" | "SENT">;
  resolvedAt?: Date;
  refundAmount?: number | null;
  replacementGrnId?: string | null;
  creditNoteRef?: string | null;
  notes?: string | null;
}

export interface GoodsReturnListFilter {
  tenantId: string | null;
  goodsReceiptId?: string;
  supplierId?: string;
  status?: GoodsReturnStatus;
  page: number;
  limit: number;
}

export interface GoodsReturnListSummary {
  id: string;
  rtvNumber: string;
  goodsReceiptId: string;
  grnNumber: string | null;
  supplierName: string | null;
  status: string;
  reason: string;
  returnedAt: Date;
  totalQuantity: number;
}

export interface GoodsReturnListResult {
  items: GoodsReturnListSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface GoodsReturnWithRelations extends GoodsReturnEntity {
  goodsReceipt: { id: string; grnNumber: string } | null;
  supplier: { id: string; name: string } | null;
  gudang: { id: string; nama: string } | null;
  returnedBy: { id: string; name: string } | null;
  items: GoodsReturnItemWithRefs[];
}

export interface GoodsReturnItemWithRefs extends GoodsReturnItemEntity {
  barang: { id: string; nama: string; kode: string } | null;
  goodsReceiptItem: {
    id: string;
    quantity: number;
    purchaseOrderItem: {
      id: string;
      unitPrice: number;
    } | null;
  } | null;
}

export interface IGoodsReturnRepository {
  findById(id: string): Promise<GoodsReturnWithRelations | null>;
  list(filter: GoodsReturnListFilter): Promise<GoodsReturnListResult>;
  generateRtvNumber(tenantId: string | null): Promise<string>;

  /**
   * Atomic: insert RTV + items, kurangi stok gudang, insert barang_keluar
   * audit (kondisi sesuai reason: RUSAK / BARU). Hanya dijalankan saat
   * status SENT, supaya DRAFT tidak menyentuh stok.
   */
  createAndSend(input: GoodsReturnCreateInput): Promise<GoodsReturnEntity>;

  /**
   * Resolve RTV (REFUNDED/REPLACED/CREDIT_NOTE/CANCELLED). CANCELLED
   * mengembalikan stok yang sebelumnya dikurangi.
   */
  resolve(
    id: string,
    input: GoodsReturnResolveInput,
  ): Promise<GoodsReturnEntity>;
}
