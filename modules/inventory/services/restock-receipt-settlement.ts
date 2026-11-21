import type {
  GuardedItemCancellation,
  RestockOrderSettlement,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseOrderItem,
  RestockPurchaseRequestForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";

/*
 * Aturan murni penutupan pengajuan restock yang sudah disetujui: sisa mana
 * yang dicoret dan bagaimana status pesanan serta pengajuannya berubah bila
 * pengajuan ini yang terakhir terbuka di pesanannya. Selama pesanan gabungan
 * masih dipakai pengajuan lain yang terbuka, tidak ada yang dicoret.
 */

/** Status pesanan yang masih boleh dibatalkan. */
const CANCELLABLE_ORDER_STATUSES: readonly string[] = ["DRAFT", "ORDERED"];
const UNPAID = "UNPAID";
/** Pesanan dianggap gabungan bila dipakai lebih dari satu pengajuan. */
const SINGLE_REQUEST_COUNT = 1;

/** Sisa satu item pesanan yang belum masuk maupun dicoret. */
export function getPurchaseOrderItemOutstanding(
  item: Pick<
    RestockPurchaseOrderItem,
    "quantity" | "receivedQuantity" | "cancelledQuantity"
  >,
): number {
  return item.quantity - item.receivedQuantity - item.cancelledQuantity;
}

/**
 * Barang yang diisi pengajuan ini di Masukkan Barang. Pesanan milik satu
 * pengajuan: semua barangnya (null). Pesanan gabungan: hanya barang di baris
 * pengajuan yang tidak ditolak.
 */
export function resolveOwnedBarangIds(
  request: Pick<RestockPurchaseRequestForReceipt, "lines">,
  linkedRequestCount: number,
): ReadonlySet<string> | null {
  if (linkedRequestCount <= SINGLE_REQUEST_COUNT) return null;
  return new Set(request.lines.map((line) => line.barangId));
}

/**
 * Pesanan ikut dibatalkan hanya bila benar-benar belum terjadi apa pun
 * padanya: belum ada barang masuk, tanpa jasa (biaya jasa tetap ditagih
 * toko), belum dibayar (pembayaran perlu diurus admin), hanya dipakai
 * pengajuan ini, dan tanpa catatan belanja lama. Selain itu pesanan ditutup
 * selesai supaya jejaknya utuh.
 */
export function canCancelUnfulfilledOrder(
  order: RestockPurchaseOrderForReceipt,
  linkedRequestCount: number,
): boolean {
  if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) return false;
  if (order.items.some((item) => item.receivedQuantity > 0)) return false;
  if (order.goodsReceiptIds.length > 0 || order.jasaItemCount > 0) {
    return false;
  }
  // Bacaan data historis tahap pembelian, sama dengan penjaga pembatalan
  // pesanan di repository.
  if (order.hasLegacyPurchases) return false;
  if ((order.paymentStatus ?? UNPAID) !== UNPAID) return false;
  return linkedRequestCount === SINGLE_REQUEST_COUNT;
}

/**
 * Akibat Batalkan oleh pengajuan terakhir yang terbuka: pesanan yang belum
 * tersentuh ikut dibatalkan; selain itu pesanannya ditutup selesai supaya
 * jejaknya utuh.
 */
export function decideLastRequestCancelSettlement(
  canCancelOrder: boolean,
): RestockOrderSettlement {
  return canCancelOrder ? "CANCEL_ORDER" : "CANCEL_REQUEST_AND_SETTLE_ORDER";
}

/** Pencoretan sisa satu item beserta item asalnya (untuk nama barang). */
export interface PlannedRemainderCancellation {
  item: RestockPurchaseOrderItem;
  cancellation: GuardedItemCancellation;
}

/**
 * Coret seluruh sisa item yang diberikan. Snapshot yang menjadi syarat
 * penulisan sudah memperhitungkan langkah sebelumnya pada penyimpanan yang
 * sama: jumlah pesanan ditambah kelebihan yang dinaikkan, dan jumlah masuk
 * ditambah yang baru dimasukkan lewat GRN.
 */
export function planRemainderCancellations(input: {
  items: RestockPurchaseOrderItem[];
  reason: string;
  enteredByItemId?: ReadonlyMap<string, number>;
  extraByItemId?: ReadonlyMap<string, number>;
}): PlannedRemainderCancellation[] {
  return input.items.flatMap((item) => {
    const expected = {
      quantity: item.quantity + (input.extraByItemId?.get(item.id) ?? 0),
      receivedQuantity:
        item.receivedQuantity + (input.enteredByItemId?.get(item.id) ?? 0),
      cancelledQuantity: item.cancelledQuantity,
    };
    const remainder = getPurchaseOrderItemOutstanding(expected);
    if (remainder <= 0) return [];
    return [
      {
        item,
        cancellation: {
          purchaseOrderItemId: item.id,
          cancelledQuantity: remainder,
          reason: input.reason,
          expected,
        },
      },
    ];
  });
}
