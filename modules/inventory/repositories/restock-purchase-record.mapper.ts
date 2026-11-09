import {
  buildRestockOrderPurchaseEvidence,
  isLegacyPurchasedOrder,
} from "../domain/restock-receipt-eligibility";
import type {
  PurchaseRecordSourceKind,
  RestockPurchaseContext,
  RestockPurchaseContextItem,
  RestockPurchaseRecordView,
} from "../domain/ports/IRestockPurchaseRecordRepository";

/** Kolom item pesanan untuk menghitung sisa belanja. */
export const CONTEXT_ITEM_SELECT = {
  id: true,
  barangId: true,
  quantity: true,
  cancelledQuantity: true,
  receivedQuantity: true,
  purchasedQuantity: true,
  barang: { select: { nama: true, satuan: true } },
} as const;

/**
 * Kolom pesanan untuk aturan data lama (`isLegacyPurchasedOrder`). Dipakai
 * konteks belanja dan pemeriksaan ulang di transaksi pencatatan belanja.
 */
export const LEGACY_PURCHASE_ORDER_SELECT = {
  status: true,
  issuedAt: true,
  items: { select: { purchasedQuantity: true, receivedQuantity: true } },
  _count: {
    select: {
      purchaseRequests: true,
      purchaseRecords: true,
      goodsReceipts: true,
    },
  },
} as const;

/** Bentuk baris hasil `LEGACY_PURCHASE_ORDER_SELECT`. */
export interface LegacyPurchaseOrderRow {
  status: string;
  issuedAt: Date | null;
  items: Array<{ purchasedQuantity: number; receivedQuantity: number }>;
  _count: {
    purchaseRequests: number;
    purchaseRecords: number;
    goodsReceipts: number;
  };
}

/** Pesanan termasuk data lama: sudah dibeli sebelum ada link belanja. */
export function isLegacyPurchaseOrderRow(row: LegacyPurchaseOrderRow): boolean {
  return isLegacyPurchasedOrder(
    buildRestockOrderPurchaseEvidence({
      status: row.status,
      issuedAt: row.issuedAt,
      purchaseRecordCount: row._count.purchaseRecords,
      goodsReceiptCount: row._count.goodsReceipts,
      linkedRequestCount: row._count.purchaseRequests,
      items: row.items,
    }),
  );
}

/** Pengajuan beserta pesanan & item pesanannya, untuk konteks belanja. */
export const PURCHASE_CONTEXT_SELECT = {
  id: true,
  nomorRequest: true,
  status: true,
  purchaseOrderId: true,
  items: {
    where: { statusApproval: { not: "REJECTED" } },
    select: { barangId: true },
  },
  purchaseOrder: {
    select: {
      ...LEGACY_PURCHASE_ORDER_SELECT,
      id: true,
      poNumber: true,
      tenantId: true,
      items: { select: CONTEXT_ITEM_SELECT },
    },
  },
} as const;

/** Bentuk baris hasil `PURCHASE_CONTEXT_SELECT`. */
export interface PurchaseContextRow {
  id: string;
  nomorRequest: string;
  status: string;
  purchaseOrderId: string | null;
  items: Array<{ barangId: string }>;
  purchaseOrder: {
    id: string;
    poNumber: string;
    status: string;
    issuedAt: Date | null;
    tenantId: string | null;
    items: RestockPurchaseContextItem[];
    _count: LegacyPurchaseOrderRow["_count"];
  } | null;
}

/** Ubah baris pengajuan menjadi konteks belanja; pesanan tenant lain dibuang. */
export function toPurchaseContext(
  row: PurchaseContextRow,
  tenantId: string,
): RestockPurchaseContext {
  const { items, purchaseOrder, ...rest } = row;
  return {
    request: {
      ...rest,
      receivableBarangIds: items.map((item) => item.barangId),
    },
    // Pesanan tenant lain diperlakukan seperti tidak ada.
    purchaseOrder:
      purchaseOrder && purchaseOrder.tenantId === tenantId
        ? toContextOrder(purchaseOrder)
        : null,
  };
}

function toContextOrder(
  order: NonNullable<PurchaseContextRow["purchaseOrder"]>,
): NonNullable<RestockPurchaseContext["purchaseOrder"]> {
  const { _count, issuedAt: _issuedAt, ...rest } = order;
  return {
    ...rest,
    linkedRequestCount: _count.purchaseRequests,
    isLegacyPurchased: isLegacyPurchaseOrderRow(order),
  };
}

/** Kolom catatan belanja yang dibaca untuk ditampilkan; sengaja minimal. */
export const PURCHASE_RECORD_VIEW_SELECT = {
  id: true,
  storeName: true,
  supplierId: true,
  purchasedAt: true,
  createdAt: true,
  notes: true,
  fotoNota: true,
  buyerName: true,
  source: true,
  // Hanya untuk `hasSignature`; kuncinya tidak pernah ikut ke tampilan.
  buyerSignatureKey: true,
  recordedBy: { select: { name: true } },
  voidedAt: true,
  voidReason: true,
  voidedBy: { select: { name: true } },
  items: {
    select: {
      id: true,
      purchaseOrderItemId: true,
      barangId: true,
      quantity: true,
      unitPrice: true,
      // Nama dari snapshot barang saat dibeli, bukan dari item pesanan.
      barang: { select: { nama: true, satuan: true } },
    },
  },
} as const;

/** Bentuk baris hasil `PURCHASE_RECORD_VIEW_SELECT`. */
export interface PurchaseRecordViewRow {
  id: string;
  storeName: string | null;
  supplierId: string | null;
  purchasedAt: Date;
  createdAt: Date;
  notes: string | null;
  fotoNota: string[];
  buyerName: string | null;
  source: PurchaseRecordSourceKind;
  buyerSignatureKey: string | null;
  recordedBy: { name: string | null } | null;
  voidedAt: Date | null;
  voidReason: string | null;
  voidedBy: { name: string | null } | null;
  items: Array<{
    id: string;
    purchaseOrderItemId: string;
    barangId: string;
    quantity: number;
    unitPrice: number | null;
    barang: { nama: string; satuan: string | null } | null;
  }>;
}

/** Ubah baris database menjadi catatan belanja untuk ditampilkan. */
export function toPurchaseRecordView(
  row: PurchaseRecordViewRow,
): RestockPurchaseRecordView {
  return {
    id: row.id,
    storeName: row.storeName,
    supplierId: row.supplierId,
    purchasedAt: row.purchasedAt,
    createdAt: row.createdAt,
    recordedBy: row.recordedBy ? { name: row.recordedBy.name } : null,
    buyerName: row.buyerName,
    source: row.source,
    hasSignature: Boolean(row.buyerSignatureKey),
    notes: row.notes,
    fotoNota: row.fotoNota,
    voidedAt: row.voidedAt,
    voidedBy: row.voidedBy ? { name: row.voidedBy.name } : null,
    voidReason: row.voidReason,
    items: row.items.map((item) => ({
      id: item.id,
      purchaseOrderItemId: item.purchaseOrderItemId,
      barangId: item.barangId,
      nama: item.barang?.nama ?? null,
      satuan: item.barang?.satuan ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}
