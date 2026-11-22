/**
 * Read-model pengajuan restock untuk UI dan presenter mobile: jumlah per
 * baris (dipesan, sudah masuk, dicoret), daftar barang masuk milik
 * pengajuan ini, dan jumlah pengajuan yang memakai pesanannya
 * (`purchaseOrder.linkedRequestCount`, untuk pesanan gabungan). Field
 * persetujuan dan `cancelReason` ikut dari baris pengajuan apa adanya.
 */

/** Pesanan tanpa hitungan pengajuan dibaca sebagai milik satu pengajuan. */
const SINGLE_REQUEST_COUNT = 1;

/** Barang masuk per GRN untuk riwayat pengajuan. */
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

/** Bagian pesanan yang dibutuhkan read-model pengajuan restock. */
export const PURCHASE_ORDER_PROGRESS_SELECT = {
  id: true,
  poNumber: true,
  status: true,
  items: {
    select: {
      barangId: true,
      quantity: true,
      receivedQuantity: true,
      cancelledQuantity: true,
      cancelReason: true,
    },
  },
  goodsReceipts: {
    select: GOODS_RECEIPT_TIMELINE_SELECT,
    orderBy: { receivedAt: "asc" },
  },
  _count: { select: { purchaseRequests: true } },
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
}

interface PurchaseOrderItemSource {
  barangId: string;
  quantity: number;
  receivedQuantity: number;
  cancelledQuantity: number;
  cancelReason: string | null;
}

interface PurchaseOrderSource {
  items: PurchaseOrderItemSource[];
  goodsReceipts: GoodsReceiptTimelineRow[];
  _count?: { purchaseRequests: number };
}

export interface RestockReadModelSource {
  items: RestockLineSource[];
  purchaseOrder: PurchaseOrderSource | null;
}

/** Jumlah per baris pengajuan, diambil dari item PO yang sama. */
export function withLineProgress<TLine extends RestockLineSource>(
  item: TLine,
  purchaseOrder: Pick<PurchaseOrderSource, "items"> | null,
): TLine & RestockLineProgress {
  // Baris yang ditolak atasan tidak ikut PO: tidak ada yang dipesan maupun masuk.
  if (item.statusApproval === "REJECTED") {
    return {
      ...item,
      orderedQuantity: 0,
      receivedQuantity: 0,
      cancelledQuantity: 0,
      cancelReason: null,
    };
  }
  const purchaseOrderItem = purchaseOrder?.items.find(
    (candidate) => candidate.barangId === item.barangId,
  );
  return {
    ...item,
    // Pesanan gabungan memuat beberapa pengajuan; sisa dihitung dari jumlah
    // di PO seperti yang dipakai server saat Lapor Barang Sampai.
    orderedQuantity: purchaseOrderItem?.quantity ?? item.jumlah,
    receivedQuantity: purchaseOrderItem?.receivedQuantity || 0,
    cancelledQuantity: purchaseOrderItem?.cancelledQuantity || 0,
    cancelReason: purchaseOrderItem?.cancelReason || null,
  };
}

/** Barang masuk (GRN) dalam bentuk riwayat. */
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
 * Pesanan di read-model: hitungan Prisma `_count` diganti
 * `linkedRequestCount`, jumlah pengajuan yang memakai pesanan ini.
 */
type ReadModelPurchaseOrder<T extends RestockReadModelSource> = Omit<
  NonNullable<T["purchaseOrder"]>,
  "_count"
> & { linkedRequestCount: number };

/**
 * Read-model pengajuan restock: jumlah per baris, plus daftar barang masuk
 * (`goodsReceipts`, terlama dulu). `purchaseOrder.goodsReceipts` tetap
 * terbaru dulu seperti sebelumnya.
 */
export type RestockReadModel<T extends RestockReadModelSource> = Omit<
  T,
  "items" | "purchaseOrder"
> & {
  items: Array<T["items"][number] & RestockLineProgress>;
  purchaseOrder: ReadModelPurchaseOrder<T> | null;
  goodsReceipts: Array<ReturnType<typeof toGoodsReceiptTimeline>>;
};

/** Susun read-model pengajuan restock dari baris database. */
export function toRestockReadModel<T extends RestockReadModelSource>(
  request: T,
): RestockReadModel<T> {
  const purchaseOrder = request.purchaseOrder;
  const items = request.items.map((item) =>
    withLineProgress(item, purchaseOrder),
  );

  return {
    ...request,
    items,
    purchaseOrder: purchaseOrder
      ? toReadModelPurchaseOrder(purchaseOrder)
      : null,
    goodsReceipts: (purchaseOrder?.goodsReceipts ?? []).map(
      toGoodsReceiptTimeline,
    ),
  };
}

function toReadModelPurchaseOrder<TOrder extends PurchaseOrderSource>(
  purchaseOrder: TOrder,
): Omit<TOrder, "_count"> & { linkedRequestCount: number } {
  const { _count, ...orderFields } = purchaseOrder;
  return {
    ...orderFields,
    goodsReceipts: [...purchaseOrder.goodsReceipts].reverse(),
    linkedRequestCount: _count?.purchaseRequests ?? SINGLE_REQUEST_COUNT,
  };
}
