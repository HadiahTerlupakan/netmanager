/**
 * Status dokumen Goods Receipt (GRN).
 * - DRAFT: belum di-post; stok belum berubah, masih bisa dihapus
 * - POSTED: stok sudah di-update di gudang; perubahan butuh CANCELLED + GRN baru
 * - CANCELLED: di-cancel setelah POSTED; stok harus direverse oleh service
 */
export type GoodsReceiptStatus = "DRAFT" | "POSTED" | "CANCELLED";

export const GOODS_RECEIPT_STATUSES: readonly GoodsReceiptStatus[] = [
  "DRAFT",
  "POSTED",
  "CANCELLED",
] as const;

export interface GoodsReceiptItemEntity {
  id: string;
  goodsReceiptId: string;
  purchaseOrderItemId: string;
  barangId: string;
  quantity: number;
  notes: string | null;
  tenantId: string | null;
}

export interface GoodsReceiptEntity {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  gudangId: string;
  receivedById: string;
  receivedAt: Date;
  status: GoodsReceiptStatus;
  notes: string | null;
  fotoBukti: string[];
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
  items: GoodsReceiptItemEntity[];
}
