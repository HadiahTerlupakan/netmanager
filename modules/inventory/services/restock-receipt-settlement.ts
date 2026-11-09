import type {
  GuardedItemCancellation,
  RestockPurchaseOrderItem,
  RestockPurchaseRequestForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";

/**
 * Akibat satu penyimpanan "Catat Barang yang Datang" terhadap status:
 * - KEEP_OPEN: masih ada sisa milik pengajuan ini yang ditunggu.
 * - SETTLE_REQUEST: barang pengajuan ini tuntas, tapi pesanan gabungan masih
 *   menunggu barang pengajuan lain; hanya pengajuan ini yang selesai.
 * - SETTLE_ORDER: tidak ada sisa di seluruh pesanan; pesanan dan semua
 *   pengajuannya selesai.
 * - CANCEL_ORDER: pesanan tuntas tanpa satu pun barang datang dan aman
 *   dibatalkan beserta pengajuannya.
 */
export type RestockReceiptSettlement =
  | "KEEP_OPEN"
  | "SETTLE_REQUEST"
  | "SETTLE_ORDER"
  | "CANCEL_ORDER";

/** Status pesanan yang masih boleh dibatalkan tanpa kiriman. */
const CANCELLABLE_ORDER_STATUSES = ["DRAFT", "ORDERED"];
const UNPAID = "UNPAID";

/** Sisa satu item pesanan yang belum datang maupun dicoret. */
export function getPurchaseOrderItemOutstanding(
  item: Pick<
    RestockPurchaseOrderItem,
    "quantity" | "receivedQuantity" | "cancelledQuantity"
  >,
): number {
  return (
    item.quantity - (item.receivedQuantity || 0) - (item.cancelledQuantity || 0)
  );
}

/** Apakah masih ada sisa pada item yang barangnya termasuk `barangIds`. */
export function hasOutstandingForBarang(
  items: RestockPurchaseOrderItem[],
  barangIds: ReadonlySet<string> | null,
): boolean {
  return items.some(
    (item) =>
      (barangIds === null || barangIds.has(item.barangId)) &&
      getPurchaseOrderItemOutstanding(item) > 0,
  );
}

export interface RestockOrderCancellationFacts {
  purchaseOrderStatus: string | null;
  items: RestockPurchaseOrderItem[];
  linkedRequestCount: number;
  jasaItemCount: number;
  goodsReceiptCount: number;
  paymentStatus: string | null;
}

/**
 * Pesanan hanya dibatalkan bila benar-benar tidak ada yang terjadi padanya:
 * belum ada barang datang, belum ada barang yang dibeli di toko, tidak ada jasa (biaya jasa tetap ditagih toko),
 * belum dibayar (pembayaran perlu diurus admin), dan hanya dipakai pengajuan
 * ini. Selain itu pesanan diselesaikan (RECEIVED) supaya jejaknya utuh.
 */
export function canCancelUnfulfilledOrder(
  facts: RestockOrderCancellationFacts,
): boolean {
  if (!CANCELLABLE_ORDER_STATUSES.includes(facts.purchaseOrderStatus ?? "")) {
    return false;
  }
  if (
    facts.items.some(
      (item) =>
        (item.receivedQuantity || 0) > 0 || (item.purchasedQuantity ?? 0) > 0,
    )
  ) {
    return false;
  }
  if (facts.goodsReceiptCount > 0 || facts.jasaItemCount > 0) return false;
  if ((facts.paymentStatus ?? UNPAID) !== UNPAID) return false;
  return facts.linkedRequestCount === 1;
}

export interface RestockSettlementFacts {
  purchaseOrderStatus: string | null;
  hasOutstandingOnOrder: boolean;
  hasOutstandingOnRequest: boolean;
  /** Hanya penyelesaian tanpa kiriman yang boleh membatalkan pesanan. */
  canCancelOrder: boolean;
}

/** Tentukan akibat penyimpanan dari keadaan pesanan sesudah perubahan. */
export function decideRestockReceiptSettlement(
  facts: RestockSettlementFacts,
): RestockReceiptSettlement {
  if (
    facts.purchaseOrderStatus === "RECEIVED" ||
    !facts.hasOutstandingOnOrder
  ) {
    return facts.canCancelOrder ? "CANCEL_ORDER" : "SETTLE_ORDER";
  }
  return facts.hasOutstandingOnRequest ? "KEEP_OPEN" : "SETTLE_REQUEST";
}

/** Status pesanan & pengajuan yang dikembalikan ke UI untuk satu keputusan. */
export function describeSettlementStatuses(
  settlement: RestockReceiptSettlement,
  current: {
    purchaseOrderStatus: string | null;
    purchaseRequestStatus: string;
  },
): { purchaseOrderStatus: string | null; purchaseRequestStatus: string } {
  switch (settlement) {
    case "CANCEL_ORDER":
      return {
        purchaseOrderStatus: "CANCELLED",
        purchaseRequestStatus: "CANCELLED",
      };
    case "SETTLE_ORDER":
      return {
        purchaseOrderStatus: "RECEIVED",
        purchaseRequestStatus: "RECEIVED",
      };
    case "SETTLE_REQUEST":
      return { ...current, purchaseRequestStatus: "RECEIVED" };
    case "KEEP_OPEN":
      return current;
  }
}

/**
 * Pesanan milik satu pengajuan: semua barangnya milik pengajuan itu (null).
 * Pesanan gabungan: hanya barang di baris pengajuan yang tidak ditolak.
 */
export function resolveOwnedBarangIds(
  purchaseRequest: RestockPurchaseRequestForReceipt,
  linkedRequestCount: number,
): ReadonlySet<string> | null {
  if (linkedRequestCount <= 1 || !purchaseRequest.receivableBarangIds) {
    return null;
  }
  return new Set(purchaseRequest.receivableBarangIds);
}

/** Keadaan item sesudah pencoretan, tanpa membaca ulang database. */
export function applyCancellationsToItems(
  items: RestockPurchaseOrderItem[],
  cancellations: Array<{
    purchaseOrderItemId: string;
    cancelledQuantity: number;
  }>,
): RestockPurchaseOrderItem[] {
  return items.map((item) => {
    const cancelledNow = cancellations
      .filter((cancellation) => cancellation.purchaseOrderItemId === item.id)
      .reduce((sum, cancellation) => sum + cancellation.cancelledQuantity, 0);
    return {
      ...item,
      cancelledQuantity: (item.cancelledQuantity || 0) + cancelledNow,
    };
  });
}

/** Pencoretan beserta snapshot item yang menjadi syarat penulisannya. */
export function toGuardedCancellations(
  items: RestockPurchaseOrderItem[],
  cancellations: Array<{
    purchaseOrderItemId: string;
    cancelledQuantity: number;
    reason: string;
  }>,
): GuardedItemCancellation[] {
  return cancellations.flatMap((cancellation) => {
    const item = items.find(
      (candidate) => candidate.id === cancellation.purchaseOrderItemId,
    );
    if (!item || getPurchaseOrderItemOutstanding(item) <= 0) return [];
    return [
      {
        purchaseOrderItemId: cancellation.purchaseOrderItemId,
        cancelledQuantity: cancellation.cancelledQuantity,
        reason: cancellation.reason,
        expected: {
          quantity: item.quantity,
          receivedQuantity: item.receivedQuantity || 0,
          cancelledQuantity: item.cancelledQuantity || 0,
        },
      },
    ];
  });
}
