import { isLineRejected } from "./approvalUtils";
import type {
  PurchaseRecordSummary,
  PurchaseRequest,
  PurchaseRequestItem,
} from "./types";

/** Angka belanja satu baris barang. */
export interface RestockLinePurchase {
  /** Jumlah yang perlu dibeli: dipesan dikurangi yang tidak jadi datang. */
  limit: number;
  /** Sudah dibeli, paling banyak `limit` (barang datang ikut dihitung). */
  purchased: number;
  remainingToBuy: number;
  /**
   * Semua yang sudah dibeli, termasuk yang kemudian dicoret karena toko tidak
   * mengirimnya. Bisa lebih besar dari `limit`.
   */
  purchasedTotal: number;
  /** Sudah dibeli tetapi dicoret karena tidak datang. */
  boughtButNotDelivered: number;
}

/** NONE = belum ada yang dibeli, PARTIAL = sebagian, ALL = semua sudah dibeli. */
export type RestockPurchaseState = "NONE" | "PARTIAL" | "ALL";

/** Status pengajuan yang masih boleh dicatat belanjanya. */
const PURCHASABLE_REQUEST_STATUSES = ["APPROVED", "ORDERED"];
/** Status pesanan yang sudah ditutup; belanja tidak bisa dicatat lagi. */
const CLOSED_ORDER_STATUSES = ["RECEIVED", "CANCELLED"];
/** Status pesanan lama yang pasti sudah lewat langkah "dibeli". */
const LEGACY_PURCHASED_ORDER_STATUSES = ["ORDERED", "PARTIAL"];

const QUANTITY_FORMAT = new Intl.NumberFormat("id-ID");
const PRICE_FORMAT = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function getReceivableLines(request: PurchaseRequest): PurchaseRequestItem[] {
  return request.items.filter((item) => !isLineRejected(item));
}

/** True bila catatan belanja sudah dibatalkan admin. */
export function isPurchaseRecordVoided(
  record: Pick<PurchaseRecordSummary, "voidedAt">,
): boolean {
  return !!record.voidedAt;
}

/**
 * Semua catatan belanja pengajuan ini, termasuk yang dibatalkan, terlama
 * dulu. Hanya untuk riwayat; hitungan & PDF memakai
 * `getRestockPurchaseRecords`.
 */
export function getAllRestockPurchaseRecords(
  request: PurchaseRequest,
): PurchaseRecordSummary[] {
  return [...(request.purchaseRecords ?? [])].sort(
    (left, right) =>
      Date.parse(left.purchasedAt) - Date.parse(right.purchasedAt) ||
      Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}

/** Catatan belanja pengajuan ini yang tidak dibatalkan, terlama dulu. */
export function getRestockPurchaseRecords(
  request: PurchaseRequest,
): PurchaseRecordSummary[] {
  return getAllRestockPurchaseRecords(request).filter(
    (record) => !isPurchaseRecordVoided(record),
  );
}

/** "Dibatalkan oleh Budi: salah toko" untuk riwayat. */
export function describePurchaseRecordVoid(
  record: Pick<PurchaseRecordSummary, "voidedBy" | "voidReason">,
): string {
  const actor = record.voidedBy?.name ? ` oleh ${record.voidedBy.name}` : "";
  const reason = record.voidReason ? `: ${record.voidReason}` : "";
  return `Dibatalkan${actor}${reason}`;
}

/** Alamat API pembatalan satu catatan belanja. */
export function buildPurchaseVoidUrl(
  requestId: string,
  recordId: string,
): string {
  return `/api/inventory/restock/requests/${encodeURIComponent(requestId)}/purchases/${encodeURIComponent(recordId)}/void`;
}

/** Gambar tanda tangan pembeli; hanya bisa dimuat lewat route ber-auth. */
export function buildPurchaseSignatureUrl(
  requestId: string,
  recordId: string,
): string {
  return `/api/inventory/restock/requests/${encodeURIComponent(requestId)}/purchases/${encodeURIComponent(recordId)}/signature`;
}

/**
 * Nama yang belanja untuk ditampilkan. Catatan lewat link menyimpan admin
 * pembuat link di `recordedBy`, jadi `buyerName` selalu didahulukan.
 */
export function getPurchaseBuyerName(
  record: Pick<PurchaseRecordSummary, "buyerName" | "recordedBy">,
): string | null {
  return record.buyerName || record.recordedBy?.name || null;
}

/** Sudah ada belanja tercatat: catatan belanja atau jumlah dibeli di pesanan. */
export function hasRestockPurchaseActivity(request: PurchaseRequest): boolean {
  if (getRestockPurchaseRecords(request).length > 0) return true;
  return request.items.some((item) => (item.purchasedQuantity ?? 0) > 0);
}

function hasArrivedGoods(request: PurchaseRequest): boolean {
  if (getRestockGoodsReceiptTimes(request).length > 0) return true;
  return getReceivableLines(request).some(
    (item) => (item.receivedQuantity || 0) > 0,
  );
}

function getRestockGoodsReceiptTimes(request: PurchaseRequest): number[] {
  const receipts =
    request.goodsReceipts ?? request.purchaseOrder?.goodsReceipts ?? [];
  return receipts.map((receipt) =>
    receipt.receivedAt ? Date.parse(receipt.receivedAt) : Number.NaN,
  );
}

/**
 * Tanggal beli diisi sebelum kiriman pertama datang: pesanan ditandai dibeli
 * sekaligus (tombol lama atau dari halaman pembelian), bukan diisi otomatis
 * oleh penerimaan pertama.
 */
function wasMarkedPurchasedBeforeArrival(
  request: PurchaseRequest,
  issuedAt: string,
): boolean {
  const receiptTimes = getRestockGoodsReceiptTimes(request);
  if (receiptTimes.length === 0) return true;
  const knownTimes = receiptTimes.filter((time) => !Number.isNaN(time));
  if (knownTimes.length === 0) return true;
  return Date.parse(issuedAt) < Math.min(...knownTimes);
}

/**
 * Data lama: pesanan sudah ditandai dibeli sekaligus tanpa satu pun catatan
 * belanja. Pesanan seperti ini tetap "sudah dibeli semua" walau barangnya
 * mulai datang, supaya statusnya tidak mundur. Penerimaan pertama pada
 * pesanan yang belum ditandai dibeli juga mengisi tanggal beli; pesanan itu
 * bukan data lama, karena tanggalnya baru terisi sesudah barang datang.
 *
 * Pesanan yang pernah punya catatan belanja, walau semuanya sudah
 * dibatalkan, juga bukan data lama: tanggal belinya diisi catatan pertama,
 * dan setelah dibatalkan barangnya memang kembali belum dibeli.
 */
export function isRestockLegacyPurchased(request: PurchaseRequest): boolean {
  const order = request.purchaseOrder;
  if (!order) return false;
  if (getAllRestockPurchaseRecords(request).length > 0) return false;
  if (hasRestockPurchaseActivity(request)) return false;
  if (order.issuedAt) {
    return wasMarkedPurchasedBeforeArrival(request, order.issuedAt);
  }
  return (
    LEGACY_PURCHASED_ORDER_STATUSES.includes(order.status ?? "") &&
    !hasArrivedGoods(request)
  );
}

/** Angka belanja satu baris; `purchased` tidak pernah melebihi batasnya. */
export function getRestockLinePurchase(
  item: PurchaseRequestItem,
  isLegacy: boolean,
): RestockLinePurchase {
  const ordered = item.orderedQuantity ?? item.jumlah;
  const limit = Math.max(ordered - (item.cancelledQuantity ?? 0), 0);
  const effective = Math.max(
    item.purchasedQuantity ?? 0,
    item.receivedQuantity || 0,
  );
  const purchasedTotal = isLegacy ? Math.max(limit, effective) : effective;
  const purchased = Math.min(purchasedTotal, limit);
  return {
    limit,
    purchased,
    remainingToBuy: limit - purchased,
    purchasedTotal,
    boughtButNotDelivered: Math.max(
      purchasedTotal - Math.max(limit, item.receivedQuantity || 0),
      0,
    ),
  };
}

/** Sejauh mana barang pengajuan ini sudah dibeli (baris ditolak tidak ikut). */
export function getRestockPurchaseState(
  request: PurchaseRequest,
): RestockPurchaseState {
  const isLegacy = isRestockLegacyPurchased(request);
  if (isLegacy) return "ALL";
  const lines = getReceivableLines(request).map((item) =>
    getRestockLinePurchase(item, false),
  );
  if (lines.every((line) => line.purchased === 0)) return "NONE";
  if (lines.every((line) => line.remainingToBuy === 0)) return "ALL";
  return "PARTIAL";
}

/** Tombol "Catat Belanja" muncul selama masih ada barang yang belum dibeli. */
export function canRecordRestockPurchase(request: PurchaseRequest): boolean {
  const order = request.purchaseOrder;
  if (!order) return false;
  if (!PURCHASABLE_REQUEST_STATUSES.includes(request.status)) return false;
  if (CLOSED_ORDER_STATUSES.includes(order.status ?? "")) return false;
  const isLegacy = isRestockLegacyPurchased(request);
  return getReceivableLines(request).some(
    (item) =>
      !!item.purchaseOrderItemId &&
      getRestockLinePurchase(item, isLegacy).remainingToBuy > 0,
  );
}

/**
 * Rincian toko untuk satu barang: "Toko A 3, Toko B 2". Jumlah yang dibeli
 * tanpa catatan (misalnya langsung dicatat datang) ditulis terpisah.
 */
export function describeLinePurchaseBreakdown(
  item: PurchaseRequestItem,
  request: PurchaseRequest,
): string | null {
  const { purchasedTotal } = getRestockLinePurchase(
    item,
    isRestockLegacyPurchased(request),
  );
  if (purchasedTotal === 0) return null;
  const perStore = new Map<string, number>();
  if (item.purchaseOrderItemId) {
    for (const record of getRestockPurchaseRecords(request)) {
      for (const line of record.items) {
        if (line.purchaseOrderItemId !== item.purchaseOrderItemId) continue;
        perStore.set(
          record.storeName,
          (perStore.get(record.storeName) ?? 0) + line.quantity,
        );
      }
    }
  }
  const parts = [...perStore].map(
    ([storeName, quantity]) =>
      `${storeName} ${QUANTITY_FORMAT.format(quantity)}`,
  );
  const recordedTotal = [...perStore.values()].reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const unrecorded = purchasedTotal - recordedTotal;
  if (unrecorded > 0) {
    const amount = QUANTITY_FORMAT.format(unrecorded);
    parts.push(
      parts.length > 0
        ? `${amount} lainnya tanpa catatan belanja`
        : `${amount} tanpa catatan belanja`,
    );
  }
  return parts.join(", ");
}

/** Isi satu belanja: "Kabel 3 roll @ Rp12.000, ONT 2 pcs". */
export function describePurchaseRecordContents(
  record: PurchaseRecordSummary,
): string {
  if (record.items.length === 0) return "Isi belanja tidak tercatat";
  return record.items
    .map((line) => {
      const text = [
        line.nama ?? "Barang",
        QUANTITY_FORMAT.format(line.quantity),
        line.satuan ?? "",
      ]
        .filter((part) => part !== "")
        .join(" ");
      return line.unitPrice === null
        ? text
        : `${text} @ Rp${PRICE_FORMAT.format(line.unitPrice)}`;
    })
    .join(", ");
}
