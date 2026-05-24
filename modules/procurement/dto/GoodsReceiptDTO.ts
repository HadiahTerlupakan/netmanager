import type {
  GoodsReceiptEntity,
  GoodsReceiptItemEntity,
} from "../domain/entities/GoodsReceipt";
import type {
  GoodsReceiptListSummary,
  GoodsReceiptWithRelations,
} from "../domain/ports/IGoodsReceiptRepository";

export interface GoodsReceiptItemDTO {
  id: string;
  purchaseOrderItemId: string;
  barangId: string;
  barangNama: string | null;
  barangKode: string | null;
  quantity: number;
  notes: string | null;
  poItemQuantity: number | null;
  poItemReceivedQuantity: number | null;
  poItemUnitPrice: number | null;
}

export interface GoodsReceiptDTO {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string | null;
  gudangId: string;
  gudangNama: string | null;
  receivedById: string;
  receiverName: string | null;
  receivedAt: string;
  status: string;
  notes: string | null;
  fotoBukti: string[];
  createdAt: string;
  updatedAt: string;
  items: GoodsReceiptItemDTO[];
}

export interface GoodsReceiptListItemDTO {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string | null;
  status: string;
  receivedAt: string;
  receiverName: string | null;
  gudangNama: string | null;
  totalQuantity: number;
}

export interface GoodsReceiptListResponseDTO {
  items: GoodsReceiptListItemDTO[];
  total: number;
  page: number;
  limit: number;
}

export function toGoodsReceiptItemDTO(
  item: GoodsReceiptItemEntity,
): GoodsReceiptItemDTO {
  return {
    id: item.id,
    purchaseOrderItemId: item.purchaseOrderItemId,
    barangId: item.barangId,
    barangNama: null,
    barangKode: null,
    quantity: item.quantity,
    notes: item.notes,
    poItemQuantity: null,
    poItemReceivedQuantity: null,
    poItemUnitPrice: null,
  };
}

export function toGoodsReceiptDTO(
  entity: GoodsReceiptEntity | GoodsReceiptWithRelations,
): GoodsReceiptDTO {
  const withRelations = entity as Partial<GoodsReceiptWithRelations>;
  return {
    id: entity.id,
    grnNumber: entity.grnNumber,
    purchaseOrderId: entity.purchaseOrderId,
    poNumber: withRelations.purchaseOrder?.poNumber ?? null,
    gudangId: entity.gudangId,
    gudangNama: withRelations.gudang?.nama ?? null,
    receivedById: entity.receivedById,
    receiverName: withRelations.receivedBy?.name ?? null,
    receivedAt: entity.receivedAt.toISOString(),
    status: entity.status,
    notes: entity.notes,
    fotoBukti: entity.fotoBukti,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    items: entity.items.map((it, idx) => {
      const enriched = (withRelations.items ?? [])[idx];
      return {
        id: it.id,
        purchaseOrderItemId: it.purchaseOrderItemId,
        barangId: it.barangId,
        barangNama: enriched?.barang?.nama ?? null,
        barangKode: enriched?.barang?.kode ?? null,
        quantity: it.quantity,
        notes: it.notes,
        poItemQuantity: enriched?.purchaseOrderItem?.quantity ?? null,
        poItemReceivedQuantity:
          enriched?.purchaseOrderItem?.receivedQuantity ?? null,
        poItemUnitPrice: enriched?.purchaseOrderItem?.unitPrice ?? null,
      };
    }),
  };
}

export function toGoodsReceiptListItemDTO(
  s: GoodsReceiptListSummary,
): GoodsReceiptListItemDTO {
  return {
    id: s.id,
    grnNumber: s.grnNumber,
    purchaseOrderId: s.purchaseOrderId,
    poNumber: s.poNumber,
    status: s.status,
    receivedAt: s.receivedAt.toISOString(),
    receiverName: s.receiverName,
    gudangNama: s.gudangNama,
    totalQuantity: s.totalQuantity,
  };
}
