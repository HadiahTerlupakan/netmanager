import type {
  Barang,
  PurchaseRequest,
  PurchaseRequestItem,
  RestockCancellationMap,
  RestockOverReceiptMap,
  RestockSubstitutionMap,
} from "./types";
import { hasRestockReceivedAnything } from "./restockProgress";
import { hasRestockPurchaseActivity } from "./restockPurchase";
import {
  buildCancellationPayload,
  buildOverReceiptPayload,
  buildSubstitutionPayload,
  getReceivableRestockItems,
  getRestockItemRemaining,
  hasMissingOverReceiptReason,
} from "./utils";

/** Alasan siap pilih untuk barang yang tidak jadi datang. */
export const RESTOCK_NOT_COMING_REASONS = [
  "Barang habis di toko",
  "Harga terlalu mahal",
  "Toko tidak mengirim",
  "Tidak jadi dibutuhkan",
] as const;

export const NOTHING_ARRIVED_MESSAGE =
  'Belum ada jumlah barang yang diisi. Kalau barangnya belum datang, tekan Tutup dan catat nanti saat barang tiba. Kalau barangnya tidak akan datang, pilih "Tidak, sisanya tidak akan datang" di bagian 3.';

/**
 * Cara pesanan disimpan:
 * - COMPLETE: semua sisa datang hari ini.
 * - WAITING: masih ada sisa yang ditunggu.
 * - FINISH: selesai dengan barang kurang, ada barang datang hari ini.
 * - FINISH_WITHOUT_DELIVERY: selesai tanpa kiriman hari ini.
 */
export type RestockReceiveMode =
  | "COMPLETE"
  | "WAITING"
  | "FINISH"
  | "FINISH_WITHOUT_DELIVERY";

export interface RestockReceiveLine {
  barangId: string;
  nama: string;
  satuan: string;
  quantity: number;
}

export interface RestockReceiveSummary {
  mode: RestockReceiveMode;
  arrivingToday: RestockReceiveLine[];
  stillAwaited: RestockReceiveLine[];
  notComing: RestockReceiveLine[];
  hasArrivalToday: boolean;
  /** Masih ada sisa sesudah jumlah hari ini; pertanyaan bagian 3 muncul. */
  hasRemainderAfterToday: boolean;
  /** Tanda "tidak datang" per barang boleh dipakai (ada kiriman, jawaban "Ya"). */
  allowsLineCancellation: boolean;
}

export interface RestockReceiveFormInput {
  request: PurchaseRequest;
  receivedItems: Record<string, number>;
  substitutions: RestockSubstitutionMap;
  cancellations: RestockCancellationMap;
  /** true = jawaban "Tidak, sisanya tidak akan datang". */
  isFinishingOrder: boolean;
  barangs: Barang[];
}

export interface RestockReceiveProblemInput extends RestockReceiveFormInput {
  overReceipts: RestockOverReceiptMap;
  closeReason: string;
  photoCount: number;
}

export interface RestockReceivePayloadInput extends RestockReceiveFormInput {
  overReceipts: RestockOverReceiptMap;
  closeReason: string;
  fotoBukti: string[];
}

/** Body PATCH /api/inventory/restock/requests/[id]/receive. */
export interface RestockReceivePayload {
  items: Record<string, number>;
  substitutions: RestockSubstitutionMap;
  cancellations: RestockCancellationMap;
  overReceipts: RestockOverReceiptMap;
  fotoBukti: string[];
  closePO: boolean;
}

function getTodayQuantity(
  item: PurchaseRequestItem,
  receivedItems: Record<string, number>,
): number {
  return Math.max(receivedItems[item.barangId] ?? 0, 0);
}

/** Sisa satu barang sesudah jumlah yang datang hari ini. */
export function getRemainingAfterToday(
  item: PurchaseRequestItem,
  todayQuantity: number,
): number {
  return Math.max(
    Math.max(getRestockItemRemaining(item), 0) - todayQuantity,
    0,
  );
}

function toLine(
  item: PurchaseRequestItem,
  quantity: number,
  replacement?: Barang,
): RestockReceiveLine {
  return {
    barangId: item.barangId,
    nama: replacement?.nama ?? item.barang.nama,
    satuan: replacement?.satuan ?? item.barang.satuan,
    quantity,
  };
}

function resolveMode(
  hasRemainder: boolean,
  hasArrival: boolean,
  isFinishingOrder: boolean,
  awaitedCount: number,
): RestockReceiveMode {
  if (!hasRemainder) return "COMPLETE";
  if (isFinishingOrder)
    return hasArrival ? "FINISH" : "FINISH_WITHOUT_DELIVERY";
  return awaitedCount === 0 ? "FINISH" : "WAITING";
}

/**
 * Ringkasan isian modal penerimaan: apa yang masuk gudang hari ini, apa yang
 * masih ditunggu, dan apa yang tidak jadi datang, beserta cara menyimpannya.
 */
export function getRestockReceiveSummary({
  request,
  receivedItems,
  substitutions,
  cancellations,
  isFinishingOrder,
  barangs,
}: RestockReceiveFormInput): RestockReceiveSummary {
  const items = getReceivableRestockItems(request);
  const hasArrivalToday = items.some(
    (item) => getTodayQuantity(item, receivedItems) > 0,
  );
  const allowsLineCancellation = hasArrivalToday && !isFinishingOrder;
  const arrivingToday: RestockReceiveLine[] = [];
  const stillAwaited: RestockReceiveLine[] = [];
  const notComing: RestockReceiveLine[] = [];

  for (const item of items) {
    const today = getTodayQuantity(item, receivedItems);
    if (today > 0) {
      const replacementId = substitutions[item.barangId];
      const replacement = replacementId
        ? barangs.find((barang) => barang.id === replacementId)
        : undefined;
      arrivingToday.push(toLine(item, today, replacement));
    }
    const remainder = getRemainingAfterToday(item, today);
    if (remainder === 0) continue;
    const isLineCancelled =
      allowsLineCancellation && item.barangId in cancellations;
    const target =
      isFinishingOrder || isLineCancelled ? notComing : stillAwaited;
    target.push(toLine(item, remainder));
  }

  const hasRemainderAfterToday = stillAwaited.length + notComing.length > 0;
  return {
    mode: resolveMode(
      hasRemainderAfterToday,
      hasArrivalToday,
      isFinishingOrder,
      stillAwaited.length,
    ),
    arrivingToday,
    stillAwaited,
    notComing,
    hasArrivalToday,
    hasRemainderAfterToday,
    allowsLineCancellation,
  };
}

/**
 * Hal yang membuat penerimaan belum bisa disimpan, dalam kalimat untuk
 * petugas. Daftar kosong berarti tombol simpan aktif.
 */
export function getRestockReceiveProblems(
  input: RestockReceiveProblemInput,
): string[] {
  const summary = getRestockReceiveSummary(input);
  const items = getReceivableRestockItems(input.request);
  const problems: string[] = [];

  if (!summary.hasArrivalToday && summary.mode !== "FINISH_WITHOUT_DELIVERY") {
    problems.push(NOTHING_ARRIVED_MESSAGE);
  }
  if (summary.hasArrivalToday && input.photoCount === 0) {
    problems.push("Foto barang yang datang dulu.");
  }
  if (
    input.isFinishingOrder &&
    summary.hasRemainderAfterToday &&
    input.closeReason.trim().length === 0
  ) {
    problems.push("Pilih alasan kenapa sisanya tidak datang.");
  }
  if (summary.allowsLineCancellation) {
    problems.push(...describeLineCancellationProblems(input, items));
  }
  if (
    hasMissingOverReceiptReason(items, input.receivedItems, input.overReceipts)
  ) {
    problems.push("Tulis alasan barang yang datang lebih banyak.");
  }
  return problems;
}

function getDisplayedName(
  item: PurchaseRequestItem,
  input: RestockReceiveFormInput,
): string {
  const replacementId = input.substitutions[item.barangId];
  const replacement = replacementId
    ? input.barangs.find((barang) => barang.id === replacementId)
    : undefined;
  return replacement?.nama ?? item.barang.nama;
}

/** Masalah tanda "tidak akan datang" per barang, menyebut nama barangnya. */
function describeLineCancellationProblems(
  input: RestockReceiveFormInput,
  items: PurchaseRequestItem[],
): string[] {
  const problems: string[] = [];
  for (const item of items) {
    const reason = input.cancellations[item.barangId];
    if (reason === undefined) continue;
    const nama = getDisplayedName(item, input);
    const today = getTodayQuantity(item, input.receivedItems);
    if (getRemainingAfterToday(item, today) === 0) {
      problems.push(
        `Barang yang sudah datang semua tidak perlu ditandai. Tekan "Ternyata masih datang" pada ${nama}.`,
      );
      continue;
    }
    if (reason.trim().length === 0) {
      problems.push(`Pilih alasan kenapa ${nama} tidak datang.`);
    }
  }
  return problems;
}

function buildCancellationsForMode(
  input: RestockReceivePayloadInput,
  summary: RestockReceiveSummary,
): RestockCancellationMap {
  const remainderIds = new Set(
    [...summary.notComing, ...summary.stillAwaited].map(
      (line) => line.barangId,
    ),
  );
  if (input.isFinishingOrder) {
    const reason = input.closeReason.trim();
    return [...remainderIds].reduce<RestockCancellationMap>((acc, id) => {
      acc[id] = reason;
      return acc;
    }, {});
  }
  if (!summary.allowsLineCancellation) return {};
  const confirmed = buildCancellationPayload(input.cancellations);
  return Object.fromEntries(
    Object.entries(confirmed).filter(([barangId]) =>
      remainderIds.has(barangId),
    ),
  );
}

/** Susun body penerimaan sesuai jawaban petugas. */
export function buildRestockReceivePayload(
  input: RestockReceivePayloadInput,
): RestockReceivePayload {
  const summary = getRestockReceiveSummary(input);
  return {
    items: input.receivedItems,
    substitutions: buildSubstitutionPayload(input.substitutions),
    cancellations: buildCancellationsForMode(input, summary),
    overReceipts: buildOverReceiptPayload(
      getReceivableRestockItems(input.request),
      input.receivedItems,
      input.overReceipts,
    ),
    fotoBukti: summary.hasArrivalToday ? input.fotoBukti : [],
    closePO: input.isFinishingOrder && summary.hasRemainderAfterToday,
  };
}

/** Label tombol simpan menurut cara pesanan disimpan. */
export function getRestockReceiveSubmitLabel(
  mode: RestockReceiveMode,
  isCancellingOrder = false,
): string {
  if (isCancellingOrder) return "Batalkan pesanan";
  switch (mode) {
    case "COMPLETE":
      return "Simpan, pesanan lengkap";
    case "WAITING":
      return "Simpan, sisa masih ditunggu";
    case "FINISH":
      return "Simpan & selesaikan pesanan";
    case "FINISH_WITHOUT_DELIVERY":
      return "Selesaikan pesanan";
  }
}

/** "Kabel Fiber 4 roll, ONT 2 pcs". */
export function describeRestockReceiveLines(
  lines: RestockReceiveLine[],
): string {
  return lines
    .map((line) => `${line.nama} ${line.quantity} ${line.satuan}`)
    .join(", ");
}

/** Sampai jumlah ini toast menyebut nama barang yang masih ditunggu. */
const MAX_AWAITED_LINES_NAMED = 2;

export const RESTOCK_ORDER_CANCELLED_MESSAGE =
  "Pesanan dibatalkan. Tidak ada barang yang masuk gudang.";

function describeAwaited(summary: RestockReceiveSummary): string {
  return summary.stillAwaited.length > MAX_AWAITED_LINES_NAMED
    ? `Masih ditunggu ${summary.stillAwaited.length} barang lagi.`
    : `Masih ditunggu: ${describeRestockReceiveLines(summary.stillAwaited)}.`;
}

function describeNotComing(summary: RestockReceiveSummary): string {
  return summary.notComing.length > MAX_AWAITED_LINES_NAMED
    ? `${summary.notComing.length} jenis barang tidak jadi datang.`
    : `Tidak jadi datang: ${describeRestockReceiveLines(summary.notComing)}.`;
}

/**
 * Toast sukses penerimaan. Status pengajuan dari server menang atas
 * ringkasan isian: pesanan gabungan bisa tetap berjalan walau baris pengajuan
 * ini sudah lengkap. null = respons tidak terbaca, pakai ringkasan saja.
 */
export function getRestockReceiveSuccessMessage(
  summary: RestockReceiveSummary,
  purchaseRequestStatus: string | null,
): string {
  if (purchaseRequestStatus === "CANCELLED") {
    return RESTOCK_ORDER_CANCELLED_MESSAGE;
  }
  const isStillOpen =
    purchaseRequestStatus !== null && purchaseRequestStatus !== "RECEIVED";
  if (summary.mode === "WAITING" || isStillOpen) {
    const prefix = summary.hasArrivalToday
      ? "Tersimpan. Barang sudah masuk gudang."
      : "Tersimpan. Barang yang tidak jadi datang sudah dicatat.";
    const awaited =
      summary.stillAwaited.length > 0
        ? describeAwaited(summary)
        : "Sisanya masih ditunggu.";
    return `${prefix} ${awaited}`;
  }
  if (summary.mode === "COMPLETE") {
    return "Tersimpan. Semua barang sudah datang. Pesanan selesai.";
  }
  return `Tersimpan. Pesanan selesai. ${describeNotComing(summary)}`;
}

/**
 * Menyelesaikan tanpa kiriman pada pesanan yang belum pernah menerima barang
 * membatalkan pesanan (server: milik pengajuan ini saja, tanpa jasa, belum
 * dibayar, belum ada belanja). Teks layar mengikuti hasil itu, bukan
 * "selesai, kurang". Pesanan yang sudah dibelanjakan ditutup, tidak dibatalkan,
 * supaya catatan uangnya tetap ada.
 */
export function isRestockFinishCancellingOrder(
  request: PurchaseRequest,
  summary: RestockReceiveSummary,
): boolean {
  if (summary.mode !== "FINISH_WITHOUT_DELIVERY") return false;
  if (hasRestockReceivedAnything(request)) return false;
  if (hasRestockPurchaseActivity(request)) return false;
  const order = request.purchaseOrder;
  if (!order) return true;
  if ((order.goodsReceipts?.length ?? 0) > 0) return false;
  if ((order.paymentStatus ?? "UNPAID") !== "UNPAID") return false;
  if ((order._count?.jasaItems ?? 0) > 0) return false;
  return (order._count?.purchaseRequests ?? 1) <= 1;
}

/** Kalimat dialog konfirmasi sebelum menyelesaikan pesanan dengan kekurangan. */
export function getRestockShortfallConfirmMessage(
  summary: RestockReceiveSummary,
  isCancellingOrder = false,
): string {
  const lines = describeRestockReceiveLines(summary.notComing);
  if (isCancellingOrder) {
    return `Batalkan pesanan ini? Belum ada barang yang datang. ${lines} tidak akan ditunggu lagi.`;
  }
  return `Selesaikan dengan barang kurang? ${lines} tidak akan ditunggu lagi.`;
}

/** Konfirmasi hanya diminta saat menyelesaikan pesanan dengan barang kurang. */
export function needsRestockShortfallConfirm(
  summary: RestockReceiveSummary,
  isFinishingOrder: boolean,
): boolean {
  return isFinishingOrder && summary.notComing.length > 0;
}

/**
 * Status pengajuan sesudah disimpan, dari `purchaseRequestStatus` tingkat
 * atas respons PATCH /receive; null bila respons tidak terbaca.
 */
export function readRestockReceiptRequestStatus(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const { purchaseRequestStatus } = body as { purchaseRequestStatus?: unknown };
  return typeof purchaseRequestStatus === "string"
    ? purchaseRequestStatus
    : null;
}

/** Isi setiap baris dengan seluruh sisanya (tombol "Semua datang lengkap"). */
export function fillAllRemaining(
  request: PurchaseRequest,
  receivedItems: Record<string, number>,
): Record<string, number> {
  return getReceivableRestockItems(request).reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.barangId] = Math.max(getRestockItemRemaining(item), 0);
      return acc;
    },
    { ...receivedItems },
  );
}

const OTHER_REASON_VALUE = "__lainnya__";
export const RESTOCK_OTHER_REASON_OPTION = {
  value: OTHER_REASON_VALUE,
  label: "Lainnya (tulis sendiri)",
} as const;

/** Apakah alasan sama dengan salah satu pilihan siap pakai. */
export function isPresetNotComingReason(reason: string): boolean {
  return RESTOCK_NOT_COMING_REASONS.some((preset) => preset === reason);
}

/**
 * Nilai <select> alasan. "Lainnya" tetap terpilih walau teksnya masih kosong;
 * dulu pilihan itu melompat kembali ke "Pilih alasan…".
 */
export function getNotComingReasonSelectValue(
  reason: string,
  isOtherSelected: boolean,
): string {
  if (isPresetNotComingReason(reason)) return reason;
  if (isOtherSelected || reason.length > 0) return OTHER_REASON_VALUE;
  return "";
}
