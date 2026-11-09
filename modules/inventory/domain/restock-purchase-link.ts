/**
 * Aturan murni link belanja tanpa login untuk satu pengajuan restock.
 * Tanpa I/O: menentukan kapan link boleh dibuat dan kapan masih berlaku.
 */

import type {
  RestockPurchaseContext,
  RestockPurchaseContextItem,
} from "./ports/IRestockPurchaseRecordRepository";
import {
  formatJakartaDate,
  isRequestFullyPurchased,
  PURCHASABLE_ORDER_STATUSES,
  PURCHASABLE_REQUEST_STATUSES,
} from "./restock-purchase-record";

/** Masa berlaku link sejak dibuat. */
export const PURCHASE_LINK_VALIDITY_DAYS = 30;
/**
 * Batas jumlah catatan belanja lewat satu link (termasuk yang dibatalkan),
 * supaya pemegang link tidak bisa mengisi daftar tanpa henti.
 */
export const MAX_RECORDS_PER_PURCHASE_LINK = 30;
/** `lastUsedAt` paling sering diperbarui sekali per selang ini. */
export const PURCHASE_LINK_TOUCH_INTERVAL_MS = 10 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Keadaan daftar belanja seperti dilihat pemegang link. */
export type PurchaseListState = "ACTIVE" | "ALL_PURCHASED" | "INACTIVE";

/** Alasan link boleh/tidak boleh dibuat, untuk panel admin. */
export type PurchaseLinkAvailability =
  | "AVAILABLE"
  | "NOT_APPROVED"
  | "ALL_PURCHASED"
  | "CLOSED"
  | "MERGED_ORDER"
  | "STORAGE_OFF";

/** Status pengajuan yang belum disetujui. */
const NOT_YET_APPROVED_STATUSES: readonly string[] = ["DRAFT", "SUBMITTED"];

/** Pesan link belanja; bahasa awam untuk pembeli dan admin gudang. */
export const PURCHASE_LINK_MESSAGES = {
  inactive: "Link ini sudah tidak berlaku.",
  conflict:
    "Daftar belanja baru saja berubah. Cek lagi jumlahnya, lalu simpan ulang.",
  allPurchased: "Semua barang sudah dibeli. Terima kasih.",
  savedPartial: "Masih ada barang yang belum dibeli di daftar ini.",
  replayMismatch:
    "Belanja yang Anda kirim sebelumnya sudah tersimpan, tetapi isiannya berbeda dengan yang sekarang. Cek daftar di atas, lalu catat lagi barang yang belum tercatat.",
  invalidSignature: "Tanda tangan dulu di kotak tanda tangan.",
  signatureTooLarge:
    "Tanda tangan terlalu besar. Hapus, lalu tanda tangan ulang.",
  storageUnavailable:
    "Tanda tangan belum bisa disimpan sekarang. Coba lagi nanti atau hubungi admin gudang.",
  requestNotFound: "Pengajuan tidak ditemukan.",
  recordLimitReached: `Link ini sudah dipakai mencatat ${MAX_RECORDS_PER_PURCHASE_LINK} kali belanja. Minta link baru ke admin gudang.`,
  dateBeforeLink:
    "Tanggal belanja tidak boleh lebih awal dari tanggal daftar belanja ini dikirim. Isi tanggal waktu barangnya dibeli.",
  availability: {
    NOT_APPROVED:
      "Link belanja baru bisa dibuat setelah pengajuan ini disetujui.",
    ALL_PURCHASED:
      "Semua barang sudah dibeli, jadi link belanja tidak diperlukan lagi.",
    CLOSED:
      "Pengajuan ini sudah selesai atau dibatalkan, jadi link belanja tidak bisa dibuat.",
    MERGED_ORDER:
      "Pengajuan ini digabung dengan pengajuan lain dalam satu pesanan, jadi link belanja tidak bisa dipakai dan belanjanya tidak dicatat. Statusnya mengikuti barang yang datang.",
    STORAGE_OFF:
      "Link belanja belum bisa dibuat karena penyimpanan tanda tangan belum aktif. Hubungi admin sistem.",
  },
} as const;

/**
 * Link bisa dipakai: belum dicabut, belum kedaluwarsa, punya tenant, dan
 * pembuatnya masih aktif.
 */
export function isPurchaseLinkUsable(
  link: {
    revokedAt: Date | null;
    expiresAt: Date;
    tenantId: string | null;
    isCreatorActive: boolean;
  },
  now: Date,
): boolean {
  return (
    link.revokedAt === null &&
    link.tenantId !== null &&
    link.isCreatorActive &&
    link.expiresAt.getTime() > now.getTime()
  );
}

/** Item pesanan milik pengajuan ini (barang di baris yang tidak ditolak). */
export function getOwnedPurchaseItems(
  context: RestockPurchaseContext,
): RestockPurchaseContextItem[] {
  if (!context.purchaseOrder) return [];
  const receivable = new Set(context.request.receivableBarangIds);
  return context.purchaseOrder.items.filter((item) =>
    receivable.has(item.barangId),
  );
}

/**
 * Pesanan dipakai lebih dari satu pengajuan (barangnya digabung per jenis).
 * Link tidak boleh dipakai di sini: pemegang link satu pengajuan akan ikut
 * melihat dan menghabiskan jatah belanja pengajuan lain.
 */
export function isMergedPurchaseOrder(
  context: RestockPurchaseContext,
): boolean {
  return (context.purchaseOrder?.linkedRequestCount ?? 0) > 1;
}

/**
 * Pesanan data lama: sudah dibeli sebelum belanja wajib dilaporkan lewat
 * link. Belanjanya tidak dicatat lagi; laporan baru justru menghapus
 * pengecualian data lama dan bisa membuat belanja tercatat dua kali.
 */
export function isLegacyPurchaseContext(
  context: RestockPurchaseContext,
): boolean {
  return context.purchaseOrder?.isLegacyPurchased ?? false;
}

function isFullyReceived(item: RestockPurchaseContextItem): boolean {
  return item.receivedQuantity >= item.quantity - item.cancelledQuantity;
}

/** Keadaan daftar milik pengajuan ini, tanpa melihat penggabungan pesanan. */
function evaluateOwnListState(
  context: RestockPurchaseContext,
): PurchaseListState {
  const { request, purchaseOrder } = context;
  if (!PURCHASABLE_REQUEST_STATUSES.includes(request.status)) return "INACTIVE";
  if (
    !purchaseOrder ||
    !PURCHASABLE_ORDER_STATUSES.includes(purchaseOrder.status)
  ) {
    return "INACTIVE";
  }

  const owned = getOwnedPurchaseItems(context);
  if (owned.length === 0 || owned.every(isFullyReceived)) return "INACTIVE";
  if (isRequestFullyPurchased(owned, request.receivableBarangIds)) {
    return "ALL_PURCHASED";
  }
  return "ACTIVE";
}

/**
 * Keadaan daftar seperti dilihat pemegang link. INACTIVE bila pengajuan/
 * pesanan tidak lagi terbuka untuk belanja, pesanannya digabung dengan
 * pengajuan lain, pesanannya data lama, tidak ada barang milik pengajuan,
 * atau semua barangnya sudah datang. ALL_PURCHASED bila semua sudah dibeli.
 * Selain itu ACTIVE.
 */
export function evaluatePurchaseListState(
  context: RestockPurchaseContext,
): PurchaseListState {
  if (isMergedPurchaseOrder(context) || isLegacyPurchaseContext(context)) {
    return "INACTIVE";
  }
  return evaluateOwnListState(context);
}

/** Alasan link boleh/tidak boleh dibuat untuk pengajuan ini. */
export function describePurchaseLinkAvailability(
  context: RestockPurchaseContext,
  isStorageAvailable: boolean,
): PurchaseLinkAvailability {
  if (NOT_YET_APPROVED_STATUSES.includes(context.request.status)) {
    return "NOT_APPROVED";
  }
  const state = evaluateOwnListState(context);
  if (state === "INACTIVE") return "CLOSED";
  if (isMergedPurchaseOrder(context)) return "MERGED_ORDER";
  if (state === "ALL_PURCHASED" || isLegacyPurchaseContext(context)) {
    return "ALL_PURCHASED";
  }
  return isStorageAvailable ? "AVAILABLE" : "STORAGE_OFF";
}

/**
 * Tanggal belanja paling awal ("YYYY-MM-DD", WIB) yang boleh dicatat lewat
 * link: sehari sebelum link dibuat. Belanja sebelum itu tidak mungkin
 * dilakukan karena daftar belanjanya belum dikirim.
 */
export function getEarliestLinkPurchaseDate(linkCreatedAt: Date): string {
  return formatJakartaDate(new Date(linkCreatedAt.getTime() - MS_PER_DAY));
}

/** Waktu kedaluwarsa link yang dibuat sekarang. */
export function buildPurchaseLinkExpiry(now: Date): Date {
  return new Date(now.getTime() + PURCHASE_LINK_VALIDITY_DAYS * MS_PER_DAY);
}

/** Isian kiriman lewat link yang dibandingkan saat kiriman diulang. */
export interface LinkSubmissionContent {
  buyerName: string;
  /** "YYYY-MM-DD". */
  purchasedAt: string;
  notes: string | null;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: number;
    unitPrice: number | null;
  }>;
}

/** Catatan tersimpan, cukup kolom yang dibandingkan dengan kiriman ulang. */
export interface StoredLinkSubmission {
  buyerName: string | null;
  purchasedAt: Date;
  notes: string | null;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: number;
    unitPrice: number | null;
  }>;
}

function describeLines(items: LinkSubmissionContent["items"]): string {
  return items
    .map(
      (item) =>
        `${item.purchaseOrderItemId}:${item.quantity}:${item.unitPrice ?? ""}`,
    )
    .sort()
    .join("|");
}

/**
 * Kiriman ulang (`clientRequestId` sama) hanya boleh dijawab "tersimpan"
 * bila isinya sama dengan catatan yang sudah ada. Tanda tangan tidak
 * dibandingkan karena gambarnya selalu dibuat ulang oleh peramban.
 */
export function isSameLinkSubmission(
  stored: StoredLinkSubmission,
  input: LinkSubmissionContent,
): boolean {
  return (
    stored.buyerName === input.buyerName &&
    formatJakartaDate(stored.purchasedAt) === input.purchasedAt &&
    (stored.notes ?? null) === (input.notes ?? null) &&
    describeLines(stored.items) === describeLines(input.items)
  );
}
