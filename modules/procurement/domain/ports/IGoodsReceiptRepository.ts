import type {
  GoodsReceiptEntity,
  GoodsReceiptItemEntity,
} from "../entities/GoodsReceipt";

export interface GoodsReceiptItemCreateInput {
  purchaseOrderItemId: string;
  barangId: string;
  quantity: number;
  notes?: string | null;
}

export interface GoodsReceiptCreateInput {
  grnNumber: string;
  purchaseOrderId: string;
  gudangId: string;
  receivedById: string;
  receivedAt?: Date;
  notes?: string | null;
  fotoBukti?: string[];
  tenantId: string | null;
  items: GoodsReceiptItemCreateInput[];
}

export interface GoodsReceiptListFilter {
  tenantId: string | null;
  purchaseOrderId?: string;
  status?: string;
  page: number;
  limit: number;
}

export interface GoodsReceiptListResult {
  items: GoodsReceiptListSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface GoodsReceiptListSummary {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string | null;
  status: string;
  receivedAt: Date;
  receiverName: string | null;
  gudangNama: string | null;
  totalQuantity: number;
}

export interface GoodsReceiptWithRelations extends GoodsReceiptEntity {
  purchaseOrder: {
    id: string;
    poNumber: string;
  } | null;
  gudang: { id: string; nama: string } | null;
  receivedBy: { id: string; name: string } | null;
  items: GoodsReceiptItemWithBarang[];
}

export interface GoodsReceiptItemWithBarang extends GoodsReceiptItemEntity {
  barang: { id: string; nama: string; kode: string } | null;
  purchaseOrderItem: {
    id: string;
    quantity: number;
    receivedQuantity: number;
    unitPrice: number;
  } | null;
}

export interface IGoodsReceiptRepository {
  findById(id: string): Promise<GoodsReceiptWithRelations | null>;
  list(filter: GoodsReceiptListFilter): Promise<GoodsReceiptListResult>;
  generateGrnNumber(tenantId: string | null): Promise<string>;

  /**
   * Buat GRN dan post stok dalam transaksi atomic:
   * 1. Insert goods_receipts + goods_receipt_items
   * 2. Update purchase_order_items.receivedQuantity
   * 3. Upsert barang_gudang.stok / stokBaru
   * 4. Insert barang_masuk record (audit trail stock-in)
   * 5. Update purchase_orders.status (PARTIAL/RECEIVED) berdasarkan total receive
   */
  createAndPost(input: GoodsReceiptCreateInput): Promise<GoodsReceiptEntity>;
}
