import type {
  GoodsReturnEntity,
  GoodsReturnItemEntity,
} from "../domain/entities/GoodsReturn";
import type {
  GoodsReturnListSummary,
  GoodsReturnWithRelations,
} from "../domain/ports/IGoodsReturnRepository";

export interface GoodsReturnItemDTO {
  id: string;
  goodsReceiptItemId: string;
  barangId: string;
  barangNama: string | null;
  barangKode: string | null;
  quantity: number;
  notes: string | null;
  unitPrice: number | null;
}

export interface GoodsReturnDTO {
  id: string;
  rtvNumber: string;
  goodsReceiptId: string;
  grnNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  gudangId: string;
  gudangNama: string | null;
  reason: string;
  status: string;
  returnedById: string;
  returnerName: string | null;
  returnedAt: string;
  resolvedAt: string | null;
  notes: string | null;
  fotoBukti: string[];
  refundAmount: number | null;
  replacementGrnId: string | null;
  creditNoteRef: string | null;
  items: GoodsReturnItemDTO[];
}

export interface GoodsReturnListItemDTO {
  id: string;
  rtvNumber: string;
  goodsReceiptId: string;
  grnNumber: string | null;
  supplierName: string | null;
  status: string;
  reason: string;
  returnedAt: string;
  totalQuantity: number;
}

export interface GoodsReturnListResponseDTO {
  items: GoodsReturnListItemDTO[];
  total: number;
  page: number;
  limit: number;
}

export function toGoodsReturnItemDTO(
  item: GoodsReturnItemEntity,
): GoodsReturnItemDTO {
  return {
    id: item.id,
    goodsReceiptItemId: item.goodsReceiptItemId,
    barangId: item.barangId,
    barangNama: null,
    barangKode: null,
    quantity: item.quantity,
    notes: item.notes,
    unitPrice: null,
  };
}

export function toGoodsReturnDTO(
  entity: GoodsReturnEntity | GoodsReturnWithRelations,
): GoodsReturnDTO {
  const withRelations = entity as Partial<GoodsReturnWithRelations>;
  return {
    id: entity.id,
    rtvNumber: entity.rtvNumber,
    goodsReceiptId: entity.goodsReceiptId,
    grnNumber: withRelations.goodsReceipt?.grnNumber ?? null,
    supplierId: entity.supplierId,
    supplierName: withRelations.supplier?.name ?? null,
    gudangId: entity.gudangId,
    gudangNama: withRelations.gudang?.nama ?? null,
    reason: entity.reason,
    status: entity.status,
    returnedById: entity.returnedById,
    returnerName: withRelations.returnedBy?.name ?? null,
    returnedAt: entity.returnedAt.toISOString(),
    resolvedAt: entity.resolvedAt ? entity.resolvedAt.toISOString() : null,
    notes: entity.notes,
    fotoBukti: entity.fotoBukti,
    refundAmount: entity.refundAmount,
    replacementGrnId: entity.replacementGrnId,
    creditNoteRef: entity.creditNoteRef,
    items: entity.items.map((it, idx) => {
      const enriched = (withRelations.items ?? [])[idx];
      return {
        id: it.id,
        goodsReceiptItemId: it.goodsReceiptItemId,
        barangId: it.barangId,
        barangNama: enriched?.barang?.nama ?? null,
        barangKode: enriched?.barang?.kode ?? null,
        quantity: it.quantity,
        notes: it.notes,
        unitPrice:
          enriched?.goodsReceiptItem?.purchaseOrderItem?.unitPrice ?? null,
      };
    }),
  };
}

export function toGoodsReturnListItemDTO(
  s: GoodsReturnListSummary,
): GoodsReturnListItemDTO {
  return {
    id: s.id,
    rtvNumber: s.rtvNumber,
    goodsReceiptId: s.goodsReceiptId,
    grnNumber: s.grnNumber,
    supplierName: s.supplierName,
    status: s.status,
    reason: s.reason,
    returnedAt: s.returnedAt.toISOString(),
    totalQuantity: s.totalQuantity,
  };
}
