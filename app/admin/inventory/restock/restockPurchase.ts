import {
  canReceiveWithoutPurchaseReport,
  getReceiveLimit,
  isLegacyPurchasedOrder,
  isMergedRestockOrder,
  type RestockPurchaseEvidence,
} from "@/modules/inventory/client";

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
  /**
   * Sudah dibeli, paling banyak `limit`. Barang yang datang tanpa catatan
   * belanja (data lama, sebelum tahap pembelian wajib) ikut dihitung.
   */
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

/** Status pengajuan yang masih boleh dibelikan. */
const PURCHASABLE_REQUEST_STATUSES = ["APPROVED", "ORDERED"];
/** Status pesanan yang sudah ditutup; tidak ada lagi yang dibeli. */
const CLOSED_ORDER_STATUSES = ["RECEIVED", "CANCELLED"];

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
  const receipts =
    request.goodsReceipts ?? request.purchaseOrder?.goodsReceipts ?? [];
  if (receipts.length > 0) return true;
  return getReceivableLines(request).some(
    (item) => (item.receivedQuantity || 0) > 0,
  );
}

/**
 * Bukti pembelian pesanan pengajuan ini, dalam bentuk yang sama dengan yang
 * dipakai server untuk memutuskan boleh/tidaknya barang dicatat datang.
 */
export function buildRestockPurchaseEvidence(
  request: PurchaseRequest,
): RestockPurchaseEvidence {
  const order = request.purchaseOrder;
  return {
    purchaseOrderStatus: order?.status ?? null,
    issuedAt: order?.issuedAt ?? null,
    purchaseRecordCount: getAllRestockPurchaseRecords(request).length,
    hasPurchasedQuantity: getReceivableLines(request).some(
      (item) => (item.purchasedQuantity ?? 0) > 0,
    ),
    hasArrivedGoods: hasArrivedGoods(request),
    linkedRequestCount: order?._count?.purchaseRequests ?? 1,
  };
}

/**
 * Data lama: pesanan yang sudah ditandai dibeli atau sudah ada barang datang
 * tanpa satu pun catatan belanja (termasuk yang dibatalkan). Pesanan seperti
 * ini tetap "sudah dibeli semua" dan link belanjanya tidak tersedia. Aturannya
 * sama persis dengan server (`isLegacyPurchasedOrder`).
 */
export function isRestockLegacyPurchased(request: PurchaseRequest): boolean {
  if (!request.purchaseOrder) return false;
  return isLegacyPurchasedOrder(buildRestockPurchaseEvidence(request));
}

/**
 * Barang boleh dicatat datang tanpa laporan belanja: data lama atau pesanan
 * gabungan. Selain itu, hanya barang yang sudah dilaporkan dibeli.
 */
export function canRestockReceiveWithoutPurchaseReport(
  request: PurchaseRequest,
): boolean {
  if (!request.purchaseOrder) return false;
  return canReceiveWithoutPurchaseReport(buildRestockPurchaseEvidence(request));
}

/** Jumlah yang boleh dicatat datang sekarang untuk satu baris barang. */
export function getRestockLineReceiveLimit(
  item: PurchaseRequestItem,
  request: PurchaseRequest,
): number {
  return getReceiveLimit(
    {
      quantity: item.orderedQuantity ?? item.jumlah,
      receivedQuantity: item.receivedQuantity || 0,
      cancelledQuantity: item.cancelledQuantity ?? 0,
      purchasedQuantity: item.purchasedQuantity ?? 0,
    },
    canRestockReceiveWithoutPurchaseReport(request),
  );
}

function isRestockOrderOpen(request: PurchaseRequest): boolean {
  if (!request.purchaseOrder) return false;
  if (!PURCHASABLE_REQUEST_STATUSES.includes(request.status)) return false;
  return !CLOSED_ORDER_STATUSES.includes(request.purchaseOrder.status ?? "");
}

/** Pesanan terbuka dan ada barang yang boleh dicatat datang sekarang. */
export function hasRestockItemsAwaitingArrival(
  request: PurchaseRequest,
): boolean {
  if (!isRestockOrderOpen(request)) return false;
  return getReceivableLines(request).some(
    (item) => getRestockLineReceiveLimit(item, request) > 0,
  );
}

/**
 * "Tutup sisa yang tidak jadi dibeli" tersedia: tahap pembelian belum
 * selesai (atau daftar belanjanya belum ada), pada pesanan yang belanjanya
 * dilaporkan lewat link.
 */
export function canCloseRestockUnpurchased(request: PurchaseRequest): boolean {
  if (!PURCHASABLE_REQUEST_STATUSES.includes(request.status)) return false;
  if (!request.purchaseOrder) return getReceivableLines(request).length > 0;
  if (CLOSED_ORDER_STATUSES.includes(request.purchaseOrder.status ?? "")) {
    return false;
  }
  if (canRestockReceiveWithoutPurchaseReport(request)) return false;
  return hasRestockItemsToBuy(request);
}

/**
 * Catatan belanja masih boleh dibatalkan: sesudah dibatalkan, jumlah dibeli
 * tiap barisnya tidak lebih kecil dari jumlah yang sudah datang.
 */
export function canVoidRestockPurchaseRecord(
  record: PurchaseRecordSummary,
  request: PurchaseRequest,
): boolean {
  return record.items.every((line) => {
    const item = request.items.find(
      (candidate) => candidate.purchaseOrderItemId === line.purchaseOrderItemId,
    );
    if (!item) return true;
    const purchasedAfter = Math.max(
      (item.purchasedQuantity ?? 0) - line.quantity,
      0,
    );
    return purchasedAfter >= (item.receivedQuantity || 0);
  });
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

/**
 * Pesanan dipakai lebih dari satu pengajuan. Belanjanya tidak dicatat lewat
 * link (pemegang link akan ikut melihat barang pengajuan lain); statusnya
 * mengikuti barang yang datang.
 */
export function isRestockMergedOrder(request: PurchaseRequest): boolean {
  return isMergedRestockOrder(
    request.purchaseOrder?._count?.purchaseRequests ?? 1,
  );
}

/** Pengajuan masih terbuka dan masih ada barang yang belum dibeli. */
export function hasRestockItemsToBuy(request: PurchaseRequest): boolean {
  if (!isRestockOrderOpen(request)) return false;
  const isLegacy = isRestockLegacyPurchased(request);
  return getReceivableLines(request).some(
    (item) =>
      !!item.purchaseOrderItemId &&
      getRestockLinePurchase(item, isLegacy).remainingToBuy > 0,
  );
}

/**
 * Aksi utama "Kirim Link Belanja": masih ada barang yang belum dibeli dan
 * pesanannya tidak digabung. Sudah dibeli atau belum hanya dicatat lewat link.
 */
export function canSendRestockPurchaseLink(request: PurchaseRequest): boolean {
  return hasRestockItemsToBuy(request) && !isRestockMergedOrder(request);
}

/**
 * Rincian toko untuk satu barang: "Toko A 3, Toko B 2". Jumlah yang dibeli
 * tanpa catatan (hanya pada data lama) ditulis terpisah.
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
