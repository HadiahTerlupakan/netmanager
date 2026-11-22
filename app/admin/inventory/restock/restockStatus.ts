import {
  getRestockStatusKey,
  isRestockLineRejected,
  isRestockServiceOnly,
  isNotEnteredCancelReason,
  RESTOCK_STATUS_LABELS,
  type RestockStatusKey,
} from "@/modules/inventory/client";

import type { PurchaseRequest, PurchaseRequestItem } from "./types";

/** Status pengajuan seperti yang dilihat pengguna: badge dan kalimat penjelas. */
export interface RestockStatus {
  key: RestockStatusKey;
  label: string;
  /** Kalimat netral tentang keadaan sekarang; tidak menyuruh menekan tombol. */
  sentence: string;
  /** Kelas warna badge; teks berkontras ≥4.5:1 terhadap latarnya. */
  badgeClassName: string;
}

const BADGE_CLASS: Record<RestockStatusKey, string> = {
  AWAITING_APPROVAL:
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  APPROVED:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  RECEIVED:
    "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-100",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  CANCELLED:
    "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
};

/** Sampai jumlah ini kalimat kekurangan menyebut barangnya satu per satu. */
const MAX_SHORT_LINES_NAMED = 2;

const AWAITING_APPROVAL_SENTENCE = "Belum diputuskan atasan.";
const WAITING_FOR_ENTRY_SENTENCE = "Menunggu laporan barang sampai.";
const PARTLY_ENTERED_SENTENCE =
  "Sebagian barang sudah sampai. Menunggu admin menyelesaikan pengajuan ini.";
const WAITING_FOR_SERVICE_SENTENCE = "Menunggu jasa ditandai selesai.";
const ALL_GOODS_ENTERED_SENTENCE = "Semua barang sudah sampai.";
const ALL_SERVICES_DONE_SENTENCE = "Semua jasa sudah selesai.";
const SERVICE_PENDING_SENTENCE = "Jasa belum ditandai selesai.";
const REJECTED_SENTENCE = "Pengajuan ini ditolak.";
const CANCELLED_SENTENCE = "Pengajuan ini dibatalkan.";

/** Baris barang yang dihitung: semua kecuali yang ditolak atasan. */
function getActiveGoodsLines(request: PurchaseRequest): PurchaseRequestItem[] {
  return request.items.filter((item) => !isRestockLineRejected(item));
}

function hasPendingService(request: PurchaseRequest): boolean {
  return (request.jasaItems ?? []).some(
    (jasa) =>
      !isRestockLineRejected(jasa) && jasa.statusKonfirmasi === "PENDING",
  );
}

/**
 * Sudah ada barang dari pengajuan ini yang masuk gudang. Hanya terjadi pada
 * pengajuan lama yang menerima barang sebagian; sekarang sekali simpan
 * langsung menyelesaikan pengajuan.
 */
function hasRestockGoodsEntered(request: PurchaseRequest): boolean {
  if ((request.goodsReceipts?.length ?? 0) > 0) return true;
  return getActiveGoodsLines(request).some((item) => item.receivedQuantity > 0);
}

/** "Pengajuan ini ditolak. Alasan: …" — alasan hanya ditulis bila ada. */
function withReason(
  sentence: string,
  reason: string | null | undefined,
): string {
  const trimmed = reason?.trim();
  return trimmed ? `${sentence} Alasan: ${trimmed}` : sentence;
}

/** "10 roll"; tanpa satuan bila data barangnya tidak lengkap. */
function withUnit(quantity: number, satuan: string | undefined): string {
  return satuan ? `${quantity} ${satuan}` : String(quantity);
}

/**
 * Alasan coret satu baris yang perlu dibaca pengguna. Alasan baku untuk sisa
 * yang tidak dimasukkan tidak ditulis karena sudah terbaca dari angkanya.
 */
export function getRestockLineCancelReason(
  item: Pick<PurchaseRequestItem, "cancelReason">,
): string | null {
  const reason = item.cancelReason?.trim();
  if (!reason || isNotEnteredCancelReason(reason)) return null;
  return reason;
}

/**
 * Kekurangan satu baris terhadap jumlah yang disetujui, bukan terhadap jumlah
 * pesanan: pesanan bisa diubah sesudah disetujui atau memuat pengajuan lain.
 */
function getApprovedShortfall(item: PurchaseRequestItem): number {
  return Math.max(item.jumlah - item.receivedQuantity, 0);
}

/** "Kabel Fiber masuk 6 dari 10 roll." — dibanding jumlah yang disetujui. */
function describeShortLine(item: PurchaseRequestItem): string {
  const nama = item.barang?.nama ?? "Barang";
  return `${nama} sampai ${item.receivedQuantity} dari ${withUnit(item.jumlah, item.barang?.satuan)}.`;
}

/** Kalimat barang pada pengajuan yang sudah dimasukkan, menyebut kekurangannya. */
function describeEnteredGoods(request: PurchaseRequest): string {
  const shortLines = getActiveGoodsLines(request).filter(
    (item) => getApprovedShortfall(item) > 0,
  );
  if (shortLines.length === 0) return ALL_GOODS_ENTERED_SENTENCE;
  if (shortLines.length > MAX_SHORT_LINES_NAMED) {
    return `${shortLines.length} jenis barang sampai kurang dari yang disetujui.`;
  }
  return shortLines.map(describeShortLine).join(" ");
}

function describeApproved(request: PurchaseRequest): string {
  if (isRestockServiceOnly(request)) return WAITING_FOR_SERVICE_SENTENCE;
  return hasRestockGoodsEntered(request)
    ? PARTLY_ENTERED_SENTENCE
    : WAITING_FOR_ENTRY_SENTENCE;
}

function describeReceived(request: PurchaseRequest): string {
  const isServicePending = hasPendingService(request);
  if (isRestockServiceOnly(request)) {
    return isServicePending
      ? SERVICE_PENDING_SENTENCE
      : ALL_SERVICES_DONE_SENTENCE;
  }
  const goods = describeEnteredGoods(request);
  return isServicePending ? `${goods} ${SERVICE_PENDING_SENTENCE}` : goods;
}

function describeStatus(
  request: PurchaseRequest,
  key: RestockStatusKey,
): string {
  switch (key) {
    case "AWAITING_APPROVAL":
      return AWAITING_APPROVAL_SENTENCE;
    case "APPROVED":
      return describeApproved(request);
    case "RECEIVED":
      return describeReceived(request);
    case "REJECTED":
      return withReason(REJECTED_SENTENCE, request.catatanApproval);
    case "CANCELLED":
      return withReason(CANCELLED_SENTENCE, request.cancelReason);
  }
}

/** Status satu pengajuan beserta kalimat penjelas dan warna badgenya. */
export function getRestockStatus(request: PurchaseRequest): RestockStatus {
  const key = getRestockStatusKey(request);
  return {
    key,
    label: RESTOCK_STATUS_LABELS[key],
    sentence: describeStatus(request, key),
    badgeClassName: BADGE_CLASS[key],
  };
}
