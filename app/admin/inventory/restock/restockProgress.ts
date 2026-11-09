import { isLineRejected } from "./approvalUtils";
import {
  getRestockLinePurchase,
  getRestockPurchaseRecords,
  getRestockPurchaseState,
  hasRestockPurchaseActivity,
  isRestockLegacyPurchased,
  type RestockPurchaseState,
} from "./restockPurchase";
import type {
  GoodsReceiptSummary,
  PurchaseRequest,
  PurchaseRequestItem,
} from "./types";

/**
 * Status pengajuan yang dilihat petugas gudang. Diturunkan dari status
 * pengajuan, status pesanan ke toko, dan jumlah per barang; tidak ada kolom
 * baru di database.
 */
export type RestockProgressKey =
  | "AWAITING_APPROVAL"
  | "REJECTED"
  | "NO_ORDER"
  | "NOT_PURCHASED"
  | "PURCHASING"
  | "PURCHASED"
  | "PARTIAL"
  | "COMPLETE"
  | "COMPLETE_SHORT"
  | "SERVICE_PENDING"
  | "CANCELLED";

export interface RestockProgress {
  key: RestockProgressKey;
  label: string;
  /** Kalimat pendek yang menjelaskan keadaan sekarang. */
  sentence: string;
  /** Kelas warna badge; teks berkontras ≥4.5:1 terhadap latarnya. */
  badgeClassName: string;
}

/** Angka satu baris barang: dipesan, sudah datang, tidak jadi datang, sisa. */
export interface RestockLineProgress {
  ordered: number;
  received: number;
  cancelled: number;
  remaining: number;
}

/**
 * Langkah pembelian di riwayat selain tiap catatan belanja: data lama yang
 * dibeli sekaligus, atau sisa barang yang belum dibeli.
 */
export interface RestockPurchaseStep {
  isDone: boolean;
  label: string;
  /** Tanggal ISO saat ditandai sudah dibeli; null bila tidak tercatat. */
  issuedAt: string | null;
  processedByName: string | null;
}

/** Tindakan penerimaan yang tersedia untuk satu status turunan. */
export interface RestockProgressActions {
  receiveLabel: string | null;
}

const PURCHASE_ORDER_DRAFT = "DRAFT";
/** Status pesanan yang sudah ditutup; tidak ada lagi barang yang ditunggu. */
const FINISHED_ORDER_STATUSES = ["RECEIVED", "CANCELLED"];
/** Sampai jumlah ini kalimat "Datang Sebagian" menyebut unit per barang. */
const MAX_LINES_FOR_UNIT_SENTENCE = 2;

const RECEIVE_LABEL_FIRST = "Catat Barang Datang";
const RECEIVE_LABEL_NEXT = "Catat Kiriman Berikutnya";
/**
 * Status yang menunggu kiriman pertama. NO_ORDER ikut: server membuat daftar
 * belanjanya otomatis saat barang dicatat datang.
 */
const RECEIVE_FIRST_KEYS: RestockProgressKey[] = [
  "NOT_PURCHASED",
  "PURCHASING",
  "PURCHASED",
  "NO_ORDER",
];

const BADGE_CLASS: Record<RestockProgressKey, string> = {
  AWAITING_APPROVAL:
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  NO_ORDER:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  NOT_PURCHASED:
    "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100",
  PURCHASING: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
  PURCHASED: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100",
  PARTIAL:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-100",
  COMPLETE:
    "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-100",
  COMPLETE_SHORT:
    "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100",
  SERVICE_PENDING:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-100",
  CANCELLED:
    "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
};

const FIXED_COPY: Partial<
  Record<RestockProgressKey, { label: string; sentence: string }>
> = {
  AWAITING_APPROVAL: {
    label: "Menunggu Persetujuan",
    sentence: "Belum diputuskan atasan.",
  },
  REJECTED: { label: "Ditolak", sentence: "Pengajuan ini tidak disetujui." },
  NO_ORDER: {
    label: "Disetujui, belum bisa dibeli",
    sentence:
      "Daftar belanjanya belum ada. Hubungi admin. Kalau barangnya sudah datang, tetap bisa dicatat.",
  },
  NOT_PURCHASED: {
    label: "Belum Dibeli",
    sentence: "Sudah disetujui. Belum ada barang yang dibeli.",
  },
  PURCHASING: { label: "Dibeli Sebagian", sentence: "" },
  PURCHASED: {
    label: "Sudah Dibeli Semua, Tunggu Barangnya",
    sentence: "Semua barang sudah dibeli. Tunggu barangnya datang.",
  },
  COMPLETE: {
    label: "Selesai, Lengkap",
    sentence: "Semua barang sudah datang.",
  },
  SERVICE_PENDING: {
    label: "Menunggu Jasa Selesai",
    sentence:
      "Tidak ada barang yang perlu dicatat. Tandai jasanya selesai setelah dikerjakan.",
  },
  CANCELLED: {
    label: "Dibatalkan",
    sentence: "Pesanan ini dibatalkan. Tidak ada barang yang masuk gudang.",
  },
};

/** Barang yang ikut dibeli dan diterima: semua baris kecuali yang ditolak. */
function getReceivableLines(request: PurchaseRequest): PurchaseRequestItem[] {
  return request.items.filter((item) => !isLineRejected(item));
}

/**
 * Angka progres satu baris; sisa tidak pernah negatif. Pada pesanan yang
 * sudah selesai, sisa yang belum datang tidak ditunggu lagi, jadi dihitung
 * sebagai tidak jadi datang (data lama ditutup tanpa mencatat jumlahnya).
 */
export function getRestockLineProgress(
  item: PurchaseRequestItem,
  isOrderFinished = false,
): RestockLineProgress {
  const ordered = item.orderedQuantity ?? item.jumlah;
  const received = item.receivedQuantity || 0;
  const recordedCancelled = item.cancelledQuantity ?? 0;
  const remaining = Math.max(ordered - received - recordedCancelled, 0);
  if (isOrderFinished) {
    return {
      ordered,
      received,
      cancelled: recordedCancelled + remaining,
      remaining: 0,
    };
  }
  return { ordered, received, cancelled: recordedCancelled, remaining };
}

/** Pengajuan atau pesanannya sudah selesai/dibatalkan; tidak ada yang ditunggu. */
export function isRestockOrderFinished(request: PurchaseRequest): boolean {
  if (request.status === "RECEIVED" || request.status === "CANCELLED") {
    return true;
  }
  return FINISHED_ORDER_STATUSES.includes(request.purchaseOrder?.status ?? "");
}

/** Pengajuan tanpa barang yang dibeli: isinya jasa saja (atau barangnya ditolak). */
export function isRestockServiceOnly(request: PurchaseRequest): boolean {
  if (getReceivableLines(request).length > 0) return false;
  return (request.jasaItems ?? []).some((item) => !isLineRejected(item));
}

/** Apakah sudah ada barang dari pengajuan ini yang masuk gudang. */
export function hasRestockReceivedAnything(request: PurchaseRequest): boolean {
  return getReceivableLines(request).some(
    (item) => getRestockLineProgress(item).received > 0,
  );
}

function hasGoodsReceipt(request: PurchaseRequest): boolean {
  const receipts =
    request.goodsReceipts ?? request.purchaseOrder?.goodsReceipts ?? [];
  return receipts.length > 0;
}

/**
 * Sudah dibeli = semua barang tercatat dibeli (atau data lama yang ditandai
 * dibeli sekaligus), atau sudah ada barang datang (barang yang datang pasti
 * sudah dibeli). Pesanan yang ditutup tanpa belanja dan tanpa kiriman tidak
 * pernah dibeli.
 */
export function isRestockPurchased(request: PurchaseRequest): boolean {
  if (hasRestockReceivedAnything(request) || hasGoodsReceipt(request)) {
    return true;
  }
  return getRestockPurchaseState(request) === "ALL";
}

function getLineName(item: PurchaseRequestItem): {
  nama: string;
  satuan: string;
} {
  // Relasi barang bisa kosong pada data lama; kalimat tetap terbaca.
  return {
    nama: item.barang?.nama ?? "Barang",
    satuan: item.barang?.satuan ?? "",
  };
}

function describePartialLine(item: PurchaseRequestItem): string {
  const { ordered, received, cancelled, remaining } =
    getRestockLineProgress(item);
  const { nama, satuan } = getLineName(item);
  const parts = [`${nama} datang ${received} dari ${ordered} ${satuan}.`];
  if (cancelled > 0) parts.push(`Tidak jadi datang ${cancelled} ${satuan}.`);
  if (remaining > 0) parts.push(`Masih ditunggu ${remaining} ${satuan}.`);
  return parts.join(" ");
}

function describePurchasingLine(item: PurchaseRequestItem): string {
  const { limit, purchased } = getRestockLinePurchase(item, false);
  const { nama, satuan } = getLineName(item);
  return `${nama} dibeli ${purchased} dari ${limit} ${satuan}.`;
}

/**
 * Kalimat "Dibeli Sebagian": per barang bila sedikit, ringkasan bila banyak.
 * Ringkasan memisahkan barang yang baru dibeli sebagian dari yang belum
 * dibeli sama sekali, supaya tidak terbaca "belum ada yang dibeli".
 */
function describePurchasingProgress(lines: PurchaseRequestItem[]): string {
  if (lines.length <= MAX_LINES_FOR_UNIT_SENTENCE) {
    return lines.map(describePurchasingLine).join(" ");
  }
  const purchases = lines.map((item) => getRestockLinePurchase(item, false));
  const fullyBoughtCount = purchases.filter(
    (line) => line.remainingToBuy === 0,
  ).length;
  const partlyBoughtCount = purchases.filter(
    (line) => line.purchased > 0 && line.remainingToBuy > 0,
  ).length;
  const notBoughtCount = lines.length - fullyBoughtCount - partlyBoughtCount;
  const parts = [
    `Dari ${lines.length} jenis barang: ${fullyBoughtCount} sudah dibeli semua`,
  ];
  if (partlyBoughtCount > 0) {
    parts.push(`${partlyBoughtCount} baru dibeli sebagian`);
  }
  if (notBoughtCount > 0) parts.push(`${notBoughtCount} belum dibeli`);
  return `${parts.join(", ")}.`;
}

const NOT_YET_BOUGHT_SUFFIX = " Masih ada barang yang belum dibeli.";

const PURCHASE_STATE_PROGRESS: Record<
  RestockPurchaseState,
  RestockProgressKey
> = {
  NONE: "NOT_PURCHASED",
  PARTIAL: "PURCHASING",
  ALL: "PURCHASED",
};

function describePartialProgress(lines: PurchaseRequestItem[]): string {
  if (lines.length <= MAX_LINES_FOR_UNIT_SENTENCE) {
    return lines.map(describePartialLine).join(" ");
  }
  const progress = lines.map((item) => getRestockLineProgress(item));
  const completeCount = progress.filter(
    (line) => line.remaining === 0 && line.cancelled === 0,
  ).length;
  const shortCount = progress.filter(
    (line) => line.remaining === 0 && line.cancelled > 0,
  ).length;
  const shortText =
    shortCount > 0 ? ` ${shortCount} jenis barang tidak datang lengkap.` : "";
  return `${completeCount} dari ${lines.length} jenis barang sudah lengkap.${shortText} Sisanya masih ditunggu.`;
}

function buildProgress(
  key: RestockProgressKey,
  sentence?: string,
  label?: string,
): RestockProgress {
  const copy = FIXED_COPY[key];
  return {
    key,
    label: label ?? copy?.label ?? key,
    sentence: sentence ?? copy?.sentence ?? "",
    badgeClassName: BADGE_CLASS[key],
  };
}

function describeShortLines(lines: PurchaseRequestItem[]): string {
  if (lines.length > MAX_LINES_FOR_UNIT_SENTENCE) {
    return `${lines.length} jenis barang tidak datang lengkap.`;
  }
  return lines
    .map((item) => {
      const { nama, satuan } = getLineName(item);
      const { cancelled } = getRestockLineProgress(item, true);
      return `${nama} kurang ${cancelled} ${satuan}.`;
    })
    .join(" ");
}

function getFinishedProgress(lines: PurchaseRequestItem[]): RestockProgress {
  const shortLines = lines.filter(
    (item) => getRestockLineProgress(item, true).cancelled > 0,
  );
  if (shortLines.length === 0) return buildProgress("COMPLETE");
  return buildProgress(
    "COMPLETE_SHORT",
    describeShortLines(shortLines),
    "Selesai, Kurang",
  );
}

/** Pengajuan jasa saja: tidak ada barang untuk dicatat datang. */
function getServiceOnlyProgress(request: PurchaseRequest): RestockProgress {
  const hasPendingService = (request.jasaItems ?? []).some(
    (item) => !isLineRejected(item) && item.statusKonfirmasi === "PENDING",
  );
  if (hasPendingService && request.status !== "RECEIVED") {
    return buildProgress("SERVICE_PENDING");
  }
  return buildProgress("COMPLETE", "Semua jasa sudah selesai.");
}

function getOngoingProgress(request: PurchaseRequest): RestockProgress {
  // Pesanan bisa ditutup/dibatalkan tanpa pengajuan ini ikut berubah (data
  // lama atau pesanan gabungan); tombol catat akan selalu ditolak server.
  const orderStatus = request.purchaseOrder?.status;
  if (orderStatus === "CANCELLED") return buildProgress("CANCELLED");
  const lines = getReceivableLines(request);
  if (orderStatus === "RECEIVED") return getFinishedProgress(lines);

  const hasReceived = lines.some(
    (item) => getRestockLineProgress(item).received > 0,
  );
  const purchaseState = getRestockPurchaseState(request);
  if (!hasReceived) {
    const key = PURCHASE_STATE_PROGRESS[purchaseState];
    return key === "PURCHASING"
      ? buildProgress(key, describePurchasingProgress(lines))
      : buildProgress(key);
  }
  const hasOutstanding = lines.some(
    (item) => getRestockLineProgress(item).remaining > 0,
  );
  if (!hasOutstanding) return getFinishedProgress(lines);
  const suffix = purchaseState === "ALL" ? "" : NOT_YET_BOUGHT_SUFFIX;
  return buildProgress(
    "PARTIAL",
    `${describePartialProgress(lines)}${suffix}`,
    "Datang Sebagian",
  );
}

/** Status turunan satu pengajuan beserta kalimat penjelasnya. */
export function getRestockProgress(request: PurchaseRequest): RestockProgress {
  switch (request.status) {
    case "DRAFT":
    case "SUBMITTED":
      return buildProgress("AWAITING_APPROVAL");
    case "REJECTED":
      return buildProgress("REJECTED");
    case "CANCELLED":
      return buildProgress("CANCELLED");
    case "RECEIVED":
      if (isRestockServiceOnly(request)) return getServiceOnlyProgress(request);
      return getFinishedProgress(getReceivableLines(request));
    case "APPROVED":
    case "ORDERED":
      if (isRestockServiceOnly(request)) return getServiceOnlyProgress(request);
      if (!request.purchaseOrder) return buildProgress("NO_ORDER");
      return getOngoingProgress(request);
  }
}

/** Tombol penerimaan yang cocok untuk status turunan. */
export function getRestockProgressActions(
  key: RestockProgressKey,
): RestockProgressActions {
  if (RECEIVE_FIRST_KEYS.includes(key)) {
    return { receiveLabel: RECEIVE_LABEL_FIRST };
  }
  if (key === "PARTIAL") return { receiveLabel: RECEIVE_LABEL_NEXT };
  return { receiveLabel: null };
}

/**
 * Pengajuan boleh dihapus selama belum ada barang datang dan belum ada barang
 * yang dibeli.
 */
export function canDeleteRestockRequest(
  request: PurchaseRequest,
  canDelete: boolean,
): boolean {
  if (!canDelete || request.status === "RECEIVED") return false;
  const poStatus = request.purchaseOrder?.status;
  if (poStatus && poStatus !== PURCHASE_ORDER_DRAFT) return false;
  if (hasRestockPurchaseActivity(request)) return false;
  return !hasRestockReceivedAnything(request);
}

/** Format tanggal pendek Indonesia, misalnya "8 Nov 2026". */
export function formatRestockDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format tanggal dan jam, misalnya "8 Nov 2026 14.20". */
export function formatRestockDateTime(value: string): string {
  const date = new Date(value);
  const time = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatRestockDate(value)} ${time}`;
}

const RECEIVED_WITHOUT_RECORD_LABEL =
  "Sudah dibeli semua (dihitung dari barang yang datang)";

function getBoughtAtOnceLabel(issuedAt: string | null): string {
  return issuedAt
    ? `Sudah dibeli semua ${formatRestockDate(issuedAt)} (dicatat sekaligus)`
    : "Sudah dibeli semua (tanggal tidak tercatat)";
}

/**
 * Langkah pembelian di riwayat di luar tiap catatan belanja. null bila semua
 * sudah tergambar lewat catatan belanja, atau pesanan sudah ditutup setelah
 * sebagian dibeli (kirimannya yang bercerita).
 */
export function getRestockPurchaseStep(
  request: PurchaseRequest,
): RestockPurchaseStep | null {
  const order = request.purchaseOrder;
  const processedByName = order?.processedBy?.name ?? null;
  const hasRecords = getRestockPurchaseRecords(request).length > 0;
  const isFinished = isRestockOrderFinished(request);
  const state = getRestockPurchaseState(request);

  if (state === "ALL") {
    if (hasRecords) return null;
    if (!isRestockLegacyPurchased(request)) {
      return {
        isDone: true,
        label: RECEIVED_WITHOUT_RECORD_LABEL,
        issuedAt: null,
        processedByName: null,
      };
    }
    const issuedAt = order?.issuedAt ?? null;
    return {
      isDone: true,
      label: getBoughtAtOnceLabel(issuedAt),
      issuedAt,
      processedByName,
    };
  }
  if (state === "PARTIAL" && isFinished) return null;
  const label =
    state === "PARTIAL"
      ? "Masih ada barang yang belum dibeli"
      : isFinished
        ? "Tidak jadi dibeli"
        : "Belum dibeli";
  return { isDone: false, label, issuedAt: null, processedByName };
}

/** Kiriman barang pengajuan ini, urut dari yang paling lama. */
export function getRestockGoodsReceipts(
  request: PurchaseRequest,
): GoodsReceiptSummary[] {
  const receipts =
    request.goodsReceipts ?? request.purchaseOrder?.goodsReceipts ?? [];
  return [...receipts].sort((left, right) => {
    const leftTime = left.receivedAt ? Date.parse(left.receivedAt) : 0;
    const rightTime = right.receivedAt ? Date.parse(right.receivedAt) : 0;
    return leftTime - rightTime;
  });
}

/** Isi satu kiriman dalam satu kalimat: "Kabel Fiber 6 roll, ONT 10 pcs". */
export function describeGoodsReceiptContents(
  receipt: GoodsReceiptSummary,
): string {
  const lines = receipt.items ?? [];
  if (lines.length === 0) return "Isi kiriman tidak tercatat";
  return lines
    .map((line) =>
      [line.nama ?? "Barang", String(line.quantity), line.satuan ?? ""]
        .filter((part) => part !== "")
        .join(" "),
    )
    .join(", ");
}
