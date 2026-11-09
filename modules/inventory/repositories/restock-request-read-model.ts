/**
 * Read-model pengajuan restock untuk UI: jumlah per baris (dipesan, dibeli,
 * datang, dicoret), daftar kiriman, dan catatan belanja milik pengajuan ini.
 */

import type { Prisma } from "@prisma/client";

import type { RestockPurchaseRecordView } from "../domain/ports/IRestockPurchaseRecordRepository";
import {
  PURCHASE_RECORD_VIEW_SELECT,
  toPurchaseRecordView,
  type PurchaseRecordViewRow,
} from "./restock-purchase-record.mapper";

/** Kiriman barang per GRN untuk timeline "Kiriman ke-N". */
const GOODS_RECEIPT_TIMELINE_SELECT = {
  id: true,
  grnNumber: true,
  fotoBukti: true,
  receivedAt: true,
  receivedBy: { select: { name: true } },
  items: {
    select: {
      barangId: true,
      quantity: true,
      barang: { select: { nama: true, satuan: true } },
    },
  },
} as const;

/** Relasi pesanan yang dibutuhkan read-model pengajuan restock. */
export const PURCHASE_ORDER_PROGRESS_INCLUDE = {
  items: true,
  processedBy: { select: { name: true } },
  // UI memakai jumlah ini untuk tahu apakah "selesaikan tanpa kiriman"
  // membatalkan pesanan (milik satu pengajuan, tanpa jasa).
  _count: { select: { purchaseRequests: true, jasaItems: true } },
  goodsReceipts: {
    select: GOODS_RECEIPT_TIMELINE_SELECT,
    orderBy: { receivedAt: "asc" },
  },
  purchaseRecords: {
    select: PURCHASE_RECORD_VIEW_SELECT,
    orderBy: [
      { purchasedAt: "asc" },
      { createdAt: "asc" },
    ] as Prisma.PurchaseRecordOrderByWithRelationInput[],
  },
} as const;

interface GoodsReceiptTimelineRow {
  id: string;
  grnNumber: string;
  fotoBukti: string[];
  receivedAt: Date;
  receivedBy: { name: string | null } | null;
  items: Array<{
    barangId: string;
    quantity: number;
    barang: { nama: string; satuan: string | null } | null;
  }>;
}

interface RestockLineSource {
  barangId: string;
  jumlah: number;
  statusApproval: string;
}

export interface RestockLineProgress {
  orderedQuantity: number;
  receivedQuantity: number;
  cancelledQuantity: number;
  cancelReason: string | null;
  /** Item pesanan untuk mencatat belanja; null bila ditolak / tidak ada. */
  purchaseOrderItemId: string | null;
  /** Jumlah tercatat dibeli (level item pesanan; pesanan gabungan = total). */
  purchasedQuantity: number;
}

interface PurchaseOrderItemSource {
  id?: string;
  barangId: string;
  quantity: number;
  receivedQuantity: number;
  cancelledQuantity: number;
  cancelReason: string | null;
  purchasedQuantity?: number;
}

export interface RestockReadModelSource {
  items: RestockLineSource[];
  purchaseOrder: {
    items: PurchaseOrderItemSource[];
    goodsReceipts: GoodsReceiptTimelineRow[];
    purchaseRecords?: PurchaseRecordViewRow[];
  } | null;
}

/** Jumlah per baris pengajuan, diambil dari item PO yang sama. */
export function withLineProgress<TLine extends RestockLineSource>(
  item: TLine,
  purchaseOrder: RestockReadModelSource["purchaseOrder"],
): TLine & RestockLineProgress {
  // Baris yang ditolak tidak ikut PO: tidak ada yang dipesan maupun datang.
  if (item.statusApproval === "REJECTED") {
    return {
      ...item,
      orderedQuantity: 0,
      receivedQuantity: 0,
      cancelledQuantity: 0,
      cancelReason: null,
      purchaseOrderItemId: null,
      purchasedQuantity: 0,
    };
  }
  const purchaseOrderItem = purchaseOrder?.items.find(
    (candidate) => candidate.barangId === item.barangId,
  );
  return {
    ...item,
    // Satu PO bisa menggabungkan beberapa pengajuan; sisa dihitung dari
    // jumlah di PO seperti yang dipakai server saat verifikasi.
    orderedQuantity: purchaseOrderItem?.quantity ?? item.jumlah,
    receivedQuantity: purchaseOrderItem?.receivedQuantity || 0,
    cancelledQuantity: purchaseOrderItem?.cancelledQuantity || 0,
    cancelReason: purchaseOrderItem?.cancelReason || null,
    purchaseOrderItemId: purchaseOrderItem?.id ?? null,
    purchasedQuantity: purchaseOrderItem?.purchasedQuantity ?? 0,
  };
}

/** Kiriman (GRN) dalam bentuk timeline. */
export function toGoodsReceiptTimeline(goodsReceipt: GoodsReceiptTimelineRow) {
  return {
    id: goodsReceipt.id,
    grnNumber: goodsReceipt.grnNumber,
    receivedAt: goodsReceipt.receivedAt,
    fotoBukti: goodsReceipt.fotoBukti,
    receivedBy: goodsReceipt.receivedBy
      ? { name: goodsReceipt.receivedBy.name }
      : null,
    items: goodsReceipt.items.map((item) => ({
      barangId: item.barangId,
      nama: item.barang?.nama ?? null,
      satuan: item.barang?.satuan ?? null,
      quantity: item.quantity,
    })),
  };
}

/**
 * Catatan belanja pesanan yang menyentuh baris pengajuan ini. Pada pesanan
 * gabungan, baris barang milik pengajuan lain disaring; catatan yang tidak
 * menyisakan baris dibuang.
 */
function toRequestPurchaseRecords(
  records: PurchaseRecordViewRow[],
  ownedPurchaseOrderItemIds: ReadonlySet<string>,
): RestockPurchaseRecordView[] {
  return records.flatMap((row) => {
    const record = toPurchaseRecordView(row);
    const items = record.items.filter((item) =>
      ownedPurchaseOrderItemIds.has(item.purchaseOrderItemId),
    );
    return items.length > 0 ? [{ ...record, items }] : [];
  });
}

type ReadModelPurchaseOrder<T extends RestockReadModelSource> = Omit<
  NonNullable<T["purchaseOrder"]>,
  "purchaseRecords"
>;

/**
 * Read-model pengajuan restock: jumlah per baris, plus daftar kiriman
 * (`goodsReceipts`, terlama dulu) dan catatan belanja (`purchaseRecords`,
 * terlama dulu). `purchaseOrder.goodsReceipts` tetap terbaru dulu seperti
 * sebelumnya; catatan belanja mentah tidak ikut di objek pesanan.
 */
export type RestockReadModel<T extends RestockReadModelSource> = Omit<
  T,
  "items" | "purchaseOrder"
> & {
  items: Array<T["items"][number] & RestockLineProgress>;
  purchaseOrder: ReadModelPurchaseOrder<T> | null;
  goodsReceipts: Array<ReturnType<typeof toGoodsReceiptTimeline>>;
  purchaseRecords: RestockPurchaseRecordView[];
};

/** Susun read-model pengajuan restock dari baris database. */
export function toRestockReadModel<T extends RestockReadModelSource>(
  request: T,
): RestockReadModel<T> {
  const purchaseOrder = request.purchaseOrder;
  const items = request.items.map((item) =>
    withLineProgress(item, purchaseOrder),
  );
  const ownedPurchaseOrderItemIds = new Set(
    items.flatMap((item) =>
      item.purchaseOrderItemId ? [item.purchaseOrderItemId] : [],
    ),
  );

  let readModelOrder: ReadModelPurchaseOrder<T> | null = null;
  if (purchaseOrder) {
    const { purchaseRecords: _purchaseRecords, ...orderFields } = purchaseOrder;
    readModelOrder = {
      ...orderFields,
      goodsReceipts: [...purchaseOrder.goodsReceipts].reverse(),
    } as ReadModelPurchaseOrder<T>;
  }

  return {
    ...request,
    items,
    purchaseOrder: readModelOrder,
    goodsReceipts: (purchaseOrder?.goodsReceipts ?? []).map(
      toGoodsReceiptTimeline,
    ),
    purchaseRecords: toRequestPurchaseRecords(
      purchaseOrder?.purchaseRecords ?? [],
      ownedPurchaseOrderItemIds,
    ),
  };
}
