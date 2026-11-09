/**
 * Aturan murni tahap "Verifikasi barang sampai" pada pengajuan restock.
 * Tanpa I/O: dipakai server (service) dan layar (lewat `client.ts`) supaya
 * keduanya selalu memutuskan hal yang sama.
 *
 * Urutan tahap: Pengajuan → Persetujuan → Pembelian (dilaporkan lewat link
 * belanja) → Verifikasi barang sampai. Barang hanya boleh dicatat datang
 * sebanyak yang sudah dilaporkan dibeli dan belum datang, kecuali pada data
 * lama dan pesanan gabungan (lihat `canReceiveWithoutPurchaseReport`).
 */

/** Bukti pembelian satu pesanan restock untuk memutuskan boleh/tidaknya verifikasi. */
export interface RestockPurchaseEvidence {
  purchaseOrderStatus: string | null;
  issuedAt: Date | string | null;
  /** Semua catatan belanja, TERMASUK yang dibatalkan. */
  purchaseRecordCount: number;
  /** Ada item dengan purchasedQuantity > 0. */
  hasPurchasedQuantity: boolean;
  /** Ada kiriman tercatat atau ada item dengan receivedQuantity > 0. */
  hasArrivedGoods: boolean;
  linkedRequestCount: number;
}

/** Angka satu item pesanan yang dipakai aturan verifikasi. */
export interface RestockReceiptItemQuantities {
  quantity: number;
  receivedQuantity: number;
  cancelledQuantity: number;
}

export interface RestockReceiptItemWithPurchase extends RestockReceiptItemQuantities {
  purchasedQuantity: number;
}

/** Status pesanan lama yang pasti sudah lewat langkah "dibeli". */
const LEGACY_PURCHASED_ORDER_STATUSES: readonly string[] = [
  "ORDERED",
  "PARTIAL",
];
/** Pesanan dianggap gabungan bila dipakai lebih dari satu pengajuan. */
const SINGLE_REQUEST_COUNT = 1;

function toTime(value: Date | string | null): number | null {
  if (value === null) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/**
 * Data lama: pesanan yang sudah lewat langkah "dibeli" sebelum belanja wajib
 * dilaporkan lewat link, tanpa catatan belanja sama sekali (termasuk yang
 * dibatalkan) dan tanpa jumlah dibeli. Tandanya salah satu dari:
 * - ada barang yang sudah datang: sejak aturan tahap pembelian berlaku,
 *   barang hanya bisa dicatat datang setelah dilaporkan dibeli (kecuali
 *   pesanan gabungan), jadi barang datang tanpa catatan belanja pasti
 *   diterima lewat alur lama, termasuk dari halaman Pembelian saat pesanan
 *   masih DRAFT;
 * - tanggal beli terisi (ditandai dibeli sekaligus); atau
 * - status pesanan ORDERED/PARTIAL.
 */
export function isLegacyPurchasedOrder(
  evidence: RestockPurchaseEvidence,
): boolean {
  if (evidence.purchaseRecordCount > 0 || evidence.hasPurchasedQuantity) {
    return false;
  }
  if (evidence.hasArrivedGoods || toTime(evidence.issuedAt) !== null) {
    return true;
  }
  return LEGACY_PURCHASED_ORDER_STATUSES.includes(
    evidence.purchaseOrderStatus ?? "",
  );
}

/** Fakta pesanan yang cukup untuk menyusun `RestockPurchaseEvidence`. */
export interface RestockOrderPurchaseFacts {
  status: string | null;
  issuedAt: Date | string | null;
  purchaseRecordCount: number;
  goodsReceiptCount: number;
  linkedRequestCount: number;
  items: ReadonlyArray<{
    purchasedQuantity?: number | null;
    receivedQuantity?: number | null;
  }>;
}

/**
 * Susun bukti pembelian dari fakta pesanan. Dipakai penerimaan barang dan
 * link belanja di server supaya keduanya membaca data lama dengan cara sama.
 */
export function buildRestockOrderPurchaseEvidence(
  facts: RestockOrderPurchaseFacts,
): RestockPurchaseEvidence {
  return {
    purchaseOrderStatus: facts.status,
    issuedAt: facts.issuedAt,
    purchaseRecordCount: facts.purchaseRecordCount,
    hasPurchasedQuantity: facts.items.some(
      (item) => (item.purchasedQuantity ?? 0) > 0,
    ),
    hasArrivedGoods:
      facts.goodsReceiptCount > 0 ||
      facts.items.some((item) => (item.receivedQuantity ?? 0) > 0),
    linkedRequestCount: facts.linkedRequestCount,
  };
}

/** Pesanan dipakai lebih dari satu pengajuan; link belanja tidak tersedia. */
export function isMergedRestockOrder(linkedRequestCount: number): boolean {
  return linkedRequestCount > SINGLE_REQUEST_COUNT;
}

/** Boleh verifikasi tanpa laporan beli: data lama atau pesanan gabungan. */
export function canReceiveWithoutPurchaseReport(
  evidence: RestockPurchaseEvidence,
): boolean {
  return (
    isMergedRestockOrder(evidence.linkedRequestCount) ||
    isLegacyPurchasedOrder(evidence)
  );
}

/** Sisa pesanan yang belum datang & belum dicoret. */
export function getOutstandingQuantity(
  item: RestockReceiptItemQuantities,
): number {
  return Math.max(
    item.quantity -
      (item.receivedQuantity || 0) -
      (item.cancelledQuantity || 0),
    0,
  );
}

/** Sudah dibeli tapi belum datang, paling banyak sisa pesanan. */
export function getPurchasedAwaitingArrival(
  item: RestockReceiptItemWithPurchase,
): number {
  const awaiting = (item.purchasedQuantity || 0) - (item.receivedQuantity || 0);
  return Math.max(Math.min(awaiting, getOutstandingQuantity(item)), 0);
}

/** Batas jumlah datang yang boleh dicatat sekarang untuk satu item. */
export function getReceiveLimit(
  item: RestockReceiptItemWithPurchase,
  isExemptFromPurchaseReport: boolean,
): number {
  return isExemptFromPurchaseReport
    ? getOutstandingQuantity(item)
    : getPurchasedAwaitingArrival(item);
}

/**
 * Yang belum dibeli dan akan dicoret oleh "Tutup sisa yang tidak jadi
 * dibeli". Barang yang datang tanpa catatan belanja (data lama) dihitung
 * sudah dibeli.
 */
export function getUnpurchasedRemainder(
  item: RestockReceiptItemWithPurchase,
): number {
  const purchased = Math.max(
    item.purchasedQuantity || 0,
    item.receivedQuantity || 0,
  );
  return Math.max(item.quantity - (item.cancelledQuantity || 0) - purchased, 0);
}

/** Pesan untuk petugas; tanpa istilah teknis. */
export const RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES = {
  notPurchasedYet:
    "Tahap pembelian belum selesai: belum ada barang yang dilaporkan dibeli lewat link belanja. Barang bisa dicatat datang setelah belanjanya dilaporkan.",
  purchasedAllArrived:
    "Semua barang yang sudah dibeli sudah dicatat datang. Sisanya bisa dicatat datang setelah pembeli melaporkan belanjanya lewat link.",
  overPurchased: (nama: string, limit: number) =>
    limit === 0
      ? `${nama} belum dilaporkan dibeli. Barang ini bisa dicatat datang setelah pembeli melaporkan belanjanya lewat link.`
      : `${nama}: yang sudah dibeli dan belum datang tinggal ${limit}. Catat paling banyak ${limit}. Sisanya bisa dicatat setelah pembeli melaporkan belanjanya lewat link.`,
  purchaseChanged:
    "Laporan belanja pesanan ini baru saja berubah, jadi barang belum dicatat. Muat ulang halaman, lalu cek lagi.",
  closeReasonMissing: "Pilih alasan kenapa sisanya tidak jadi dibeli.",
  closeWithDelivery:
    "Tutup sisa yang tidak jadi dibeli tidak bisa digabung dengan barang datang. Simpan barang datang dulu.",
  nothingUnpurchased:
    "Semua barang sudah dibeli. Tidak ada sisa yang bisa ditutup.",
} as const;
