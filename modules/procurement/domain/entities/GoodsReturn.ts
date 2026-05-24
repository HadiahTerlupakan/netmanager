/**
 * Alasan retur barang ke vendor.
 * - DAMAGED: barang rusak / DOA
 * - WRONG_SPEC: tidak sesuai spesifikasi PO
 * - EXCESS: kelebihan kirim oleh vendor
 * - OTHER: alasan lain (wajib dijelaskan di notes)
 */
export type GoodsReturnReason = "DAMAGED" | "WRONG_SPEC" | "EXCESS" | "OTHER";

export const GOODS_RETURN_REASONS: readonly GoodsReturnReason[] = [
  "DAMAGED",
  "WRONG_SPEC",
  "EXCESS",
  "OTHER",
] as const;

/**
 * Status RTV:
 * - DRAFT: belum dikirim ke vendor; stok belum dikurangi
 * - SENT: sudah dikirim balik; stok sudah dikurangi
 * - REFUNDED: vendor sudah refund (cash/transfer)
 * - REPLACED: vendor sudah ganti barang baru
 * - CREDIT_NOTE: vendor terbitkan credit note (offset PO berikutnya)
 * - CANCELLED: dibatalkan; stok dikembalikan
 */
export type GoodsReturnStatus =
  | "DRAFT"
  | "SENT"
  | "REFUNDED"
  | "REPLACED"
  | "CREDIT_NOTE"
  | "CANCELLED";

export const GOODS_RETURN_STATUSES: readonly GoodsReturnStatus[] = [
  "DRAFT",
  "SENT",
  "REFUNDED",
  "REPLACED",
  "CREDIT_NOTE",
  "CANCELLED",
] as const;

export interface GoodsReturnItemEntity {
  id: string;
  goodsReturnId: string;
  goodsReceiptItemId: string;
  barangId: string;
  quantity: number;
  notes: string | null;
  tenantId: string | null;
}

export interface GoodsReturnEntity {
  id: string;
  rtvNumber: string;
  goodsReceiptId: string;
  supplierId: string | null;
  gudangId: string;
  reason: GoodsReturnReason;
  status: GoodsReturnStatus;
  returnedById: string;
  returnedAt: Date;
  resolvedAt: Date | null;
  notes: string | null;
  fotoBukti: string[];
  refundAmount: number | null;
  replacementGrnId: string | null;
  creditNoteRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
  items: GoodsReturnItemEntity[];
}
