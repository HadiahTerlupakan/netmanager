import type { RestockPurchaseOrderItem } from "../domain/ports/IRestockGoodsReceiptRepository";
import {
  canEnterRestockGoods,
  getRestockStatusKey,
  type RestockStatusInput,
  type RestockStatusKey,
} from "../domain/restock-request-status";
import {
  ENTRY_LINES_MISMATCH_MESSAGE,
  ENTRY_PHOTO_MISSING_MESSAGE,
  NOTHING_ENTERED_MESSAGE,
  receiptFailure,
  type ReceiveRestockRequestInput,
  type RestockReceiptFailure,
} from "./restock-goods-receipt.contracts";
import {
  resolveOverReceipts,
  RestockOverReceiptInvalidError,
  type ResolvedOverReceipt,
} from "./restock-over-receipt";
import { getPurchaseOrderItemOutstanding } from "./restock-receipt-settlement";

/*
 * Aturan isian Lapor Barang Sampai, tanpa I/O: kapan tombolnya boleh dipakai,
 * baris yang wajib diisi, foto bukti, kelebihan, dan kapan pengajuan boleh
 * diselesaikan tanpa barang.
 */

const ENTRY_BLOCKED_MESSAGES: Record<
  Exclude<RestockStatusKey, "APPROVED">,
  string
> = {
  AWAITING_APPROVAL:
    "Pengajuan ini belum disetujui. Barang sampai bisa dilaporkan setelah atasan menyetujuinya.",
  RECEIVED:
    "Pengajuan ini sudah selesai, jadi barang sampai tidak bisa dilaporkan lagi. Muat ulang halaman untuk melihat keadaan terbarunya.",
  CANCELLED:
    "Pengajuan ini sudah dibatalkan, jadi barang sampai tidak bisa dilaporkan. Kalau barangnya tetap datang, buat pengajuan baru.",
  REJECTED:
    "Pengajuan ini sudah ditolak, jadi barang sampai tidak bisa dilaporkan.",
};

const SERVICE_ONLY_ENTRY_MESSAGE =
  "Pengajuan ini hanya berisi jasa, jadi tidak ada barang yang perlu dilaporkan sampai. Tandai jasanya selesai lewat Konfirmasi Jasa.";

/** Bagian input Lapor Barang Sampai yang diperiksa terhadap item pesanan. */
export type RestockEntryInput = Pick<
  ReceiveRestockRequestInput,
  | "receivedItems"
  | "substitutions"
  | "overReceipts"
  | "fotoBukti"
  | "canIncreasePurchaseOrder"
>;

/** Jumlah masuk untuk satu item pesanan milik pengajuan. */
export interface RestockEntryLine {
  item: RestockPurchaseOrderItem;
  quantity: number;
}

/** Isian Lapor Barang Sampai yang sudah lolos pemeriksaan. */
export interface RestockEntryPlan {
  /** Semua item yang masih punya sisa, dengan jumlah masuknya (boleh 0). */
  lines: RestockEntryLine[];
  /** Item yang masuk melebihi sisa; jumlah pesanannya dinaikkan. */
  overReceipts: ResolvedOverReceipt[];
}

export type RestockEntryPlanResult =
  | { success: true; data: RestockEntryPlan }
  | RestockReceiptFailure;

/** Alasan Lapor Barang Sampai tidak bisa dipakai pada pengajuan ini; null bila bisa. */
export function describeEntryBlocker(
  status: RestockStatusInput,
): string | null {
  if (canEnterRestockGoods(status)) return null;
  const key = getRestockStatusKey(status);
  return key === "APPROVED"
    ? SERVICE_ONLY_ENTRY_MESSAGE
    : ENTRY_BLOCKED_MESSAGES[key];
}

/**
 * Periksa isian terhadap item pesanan milik pengajuan:
 * 1. kunci jumlah tepat semua item yang masih punya sisa, dan barang
 *    pengganti hanya untuk barang yang dimasukkan;
 * 2. minimal satu jumlah lebih dari 0, kecuali pengajuan lama yang sudah
 *    pernah menerima sesuatu (diselesaikan tanpa barang tambahan);
 * 3. foto bukti wajib bila ada barang yang masuk;
 * 4. kelebihan butuh alasan dan izin menaikkan jumlah pesanan.
 */
export function planRestockEntry(params: {
  items: RestockPurchaseOrderItem[];
  input: RestockEntryInput;
  hasEnteredAnything: boolean;
}): RestockEntryPlanResult {
  const { input } = params;
  const openItems = params.items.filter(
    (item) => getPurchaseOrderItemOutstanding(item) > 0,
  );
  const enteredKeys = Object.keys(input.receivedItems);
  if (
    !isSameKeySet(
      openItems.map((item) => item.barangId),
      enteredKeys,
    )
  ) {
    return receiptFailure("INVALID", ENTRY_LINES_MISMATCH_MESSAGE);
  }
  const lines = openItems.map((item) => ({
    item,
    quantity: input.receivedItems[item.barangId] ?? 0,
  }));
  const enteredBarangIds = new Set(
    lines.filter((line) => line.quantity > 0).map((line) => line.item.barangId),
  );
  const substitutedBarangIds = Object.keys(input.substitutions);
  if (
    substitutedBarangIds.some((barangId) => !enteredBarangIds.has(barangId))
  ) {
    return receiptFailure("INVALID", ENTRY_LINES_MISMATCH_MESSAGE);
  }
  if (enteredBarangIds.size === 0) {
    return params.hasEnteredAnything
      ? { success: true, data: { lines, overReceipts: [] } }
      : receiptFailure("INVALID", NOTHING_ENTERED_MESSAGE);
  }
  if (input.fotoBukti.length === 0) {
    return receiptFailure("INVALID", ENTRY_PHOTO_MISSING_MESSAGE);
  }
  return planOverReceipts(lines, input);
}

function isSameKeySet(expected: string[], actual: string[]): boolean {
  const expectedKeys = new Set(expected);
  return (
    expectedKeys.size === actual.length &&
    actual.every((key) => expectedKeys.has(key))
  );
}

/** Kelebihan yang sah: beralasan dan boleh dinaikkan oleh akun ini. */
function planOverReceipts(
  lines: RestockEntryLine[],
  input: RestockEntryInput,
): RestockEntryPlanResult {
  let overReceipts: ResolvedOverReceipt[];
  try {
    overReceipts = resolveOverReceipts(
      lines.map(({ item, quantity }) => ({
        purchaseOrderItemId: item.id,
        originalBarangId: item.barangId,
        barangName: item.barang?.nama ?? item.barangId,
        quantity,
        remaining: getPurchaseOrderItemOutstanding(item),
      })),
      input.overReceipts,
    );
  } catch (error: unknown) {
    if (error instanceof RestockOverReceiptInvalidError) {
      return receiptFailure("INVALID", error.message);
    }
    throw error;
  }
  if (overReceipts.length > 0 && !input.canIncreasePurchaseOrder) {
    return receiptFailure("FORBIDDEN", describeForbiddenIncrease(overReceipts));
  }
  return { success: true, data: { lines, overReceipts } };
}

function describeForbiddenIncrease(
  overReceipts: ResolvedOverReceipt[],
): string {
  const barangNames = overReceipts.map((item) => item.barangName).join(", ");
  return (
    `${barangNames} datang lebih banyak dari pesanan. Melaporkan kelebihannya berarti menambah jumlah pesanan ke toko, dan akun Anda tidak punya izin untuk itu. ` +
    "Laporkan sesuai sisa pesanan saja, atau minta atasan yang boleh mengubah pesanan untuk melaporkan barang ini."
  );
}
