import type {
  GuardedItemCancellation,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseOrderItem,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import {
  buildRestockOrderPurchaseEvidence,
  getPurchasedAwaitingArrival,
  getReceiveLimit,
  getUnpurchasedRemainder,
  RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES,
  type RestockPurchaseEvidence,
  type RestockReceiptItemWithPurchase,
} from "../domain/restock-receipt-eligibility";
import { MAX_CANCEL_REASON_LENGTH } from "./RestockItemCancellationService";
import type { ResolvedCancellation } from "./RestockItemCancellationService";

/*
 * Aturan tahap pembelian untuk pencatatan barang datang restock, dipakai
 * `RestockGoodsReceiptService`: bukti pembelian pesanan, batas jumlah datang
 * per barang, dan penutupan sisa yang tidak jadi dibeli. Tanpa I/O.
 */

/** Angka item pesanan untuk aturan verifikasi; jumlah dibeli kosong = 0. */
export function toItemWithPurchase(
  item: RestockPurchaseOrderItem,
): RestockReceiptItemWithPurchase {
  return {
    quantity: item.quantity,
    receivedQuantity: item.receivedQuantity || 0,
    cancelledQuantity: item.cancelledQuantity || 0,
    purchasedQuantity: item.purchasedQuantity ?? 0,
  };
}

/** Bukti pembelian pesanan untuk aturan tahap verifikasi barang sampai. */
export function buildPurchaseEvidence(
  purchaseOrder: RestockPurchaseOrderForReceipt,
  linkedRequestCount: number,
): RestockPurchaseEvidence {
  return buildRestockOrderPurchaseEvidence({
    status: purchaseOrder.status ?? null,
    issuedAt: purchaseOrder.issuedAt ?? null,
    purchaseRecordCount: purchaseOrder.purchaseRecordCount ?? 0,
    goodsReceiptCount: purchaseOrder.goodsReceiptCount ?? 0,
    linkedRequestCount,
    items: purchaseOrder.items,
  });
}

/**
 * Jumlah datang satu item dari isian UI. Kuncinya barang yang tampil di
 * pengajuan, lalu barang pengganti, lalu id item pesanan.
 */
export function readReceivedQuantity(
  item: RestockPurchaseOrderItem,
  receivedItems: Record<string, number>,
  replacementBarangId: string | undefined,
): number {
  return (
    receivedItems[item.barangId] ??
    (replacementBarangId ? receivedItems[replacementBarangId] : undefined) ??
    receivedItems[item.id] ??
    0
  );
}

/**
 * Tidak ada barang yang sudah dibeli dan belum datang: bedakan "belum ada
 * yang dibeli" dari "yang dibeli sudah datang semua", supaya petugas tidak
 * diberi tahu belum ada belanja padahal sudah ada.
 */
function describeNothingAwaitingArrival(
  quantities: RestockReceiptItemWithPurchase[],
): string {
  return quantities.some((item) => item.purchasedQuantity > 0)
    ? RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.purchasedAllArrived
    : RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.notPurchasedYet;
}

/**
 * Masalah tahap pembelian pada isian barang datang, atau null bila semua
 * jumlah masih dalam batas yang sudah dibeli dan belum datang.
 */
export function describePurchaseStageProblem(
  items: RestockPurchaseOrderItem[],
  receivedItems: Record<string, number>,
  substitutions: Record<string, string> | undefined,
): string | null {
  const quantities = items.map(toItemWithPurchase);
  if (quantities.every((item) => getPurchasedAwaitingArrival(item) === 0)) {
    return describeNothingAwaitingArrival(quantities);
  }
  const problems = items.flatMap((item, index) => {
    const quantity = Number(
      readReceivedQuantity(item, receivedItems, substitutions?.[item.barangId]),
    );
    const limit = getReceiveLimit(quantities[index], false);
    if (Number.isNaN(quantity) || quantity <= limit) return [];
    return [
      RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.overPurchased(
        item.barang?.nama ?? item.barangId,
        limit,
      ),
    ];
  });
  return problems.length > 0 ? problems.join("\n") : null;
}

/** Masalah alasan "tidak jadi dibeli", atau null bila sah. */
export function describeCloseReasonProblem(reason: string): string | null {
  if (reason.length === 0) {
    return RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.closeReasonMissing;
  }
  if (reason.length > MAX_CANCEL_REASON_LENGTH) {
    return `Alasan barang tidak jadi dibeli terlalu panjang. Paling banyak ${MAX_CANCEL_REASON_LENGTH} huruf.`;
  }
  return null;
}

/** Pencoretan bagian yang belum dibeli untuk barang milik pengajuan ini. */
export function planUnpurchasedCancellations(
  items: RestockPurchaseOrderItem[],
  ownedBarangIds: ReadonlySet<string> | null,
  reason: string,
): ResolvedCancellation[] {
  return items.flatMap((item) => {
    if (ownedBarangIds && !ownedBarangIds.has(item.barangId)) return [];
    const remainder = getUnpurchasedRemainder(toItemWithPurchase(item));
    if (remainder <= 0) return [];
    return [
      {
        purchaseOrderItemId: item.id,
        barangId: item.barangId,
        cancelledQuantity: remainder,
        reason,
      },
    ];
  });
}

/**
 * Tambahkan syarat "jumlah dibeli belum berubah" pada pencoretan, supaya
 * laporan belanja yang masuk bersamaan menggagalkan penutupan.
 */
export function withExpectedPurchasedQuantity(
  cancellations: GuardedItemCancellation[],
  items: RestockPurchaseOrderItem[],
): GuardedItemCancellation[] {
  return cancellations.map((cancellation) => ({
    ...cancellation,
    expected: {
      ...cancellation.expected,
      purchasedQuantity:
        items.find((item) => item.id === cancellation.purchaseOrderItemId)
          ?.purchasedQuantity ?? 0,
    },
  }));
}
