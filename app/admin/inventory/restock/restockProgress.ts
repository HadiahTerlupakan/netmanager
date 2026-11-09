import { isLineRejected } from "./approvalUtils";
import {
  canCloseRestockUnpurchased,
  canRestockReceiveWithoutPurchaseReport,
  canSendRestockPurchaseLink,
  getRestockLinePurchase,
  getRestockPurchaseRecords,
  getRestockPurchaseState,
  hasRestockItemsAwaitingArrival,
  hasRestockPurchaseActivity,
  isRestockMergedOrder,
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

/** Tahap pengajuan: 1 Pengajuan, 2 Persetujuan, 3 Pembelian, 4 Verifikasi. */
export type RestockStageNumber = 1 | 2 | 3 | 4;

export const RESTOCK_STAGE_TITLES: Record<RestockStageNumber, string> = {
  1: "Pengajuan",
  2: "Persetujuan",
  3: "Pembelian",
  4: "Verifikasi barang sampai",
};

export const RESTOCK_STAGE_COUNT = 4;

export interface RestockProgress {
  key: RestockProgressKey;
  /** Tahap yang sedang berjalan; null bila pengajuan dibatalkan. */
  stage: RestockStageNumber | null;
  /**
   * Tahap tempat pengajuan berhenti tanpa selesai: 2 bila ditolak, tahap
   * terakhir yang dicapai bila dibatalkan. Null bila tidak berhenti.
   */
  stoppedStage: RestockStageNumber | null;
  /**
   * Tahap pembelian belum selesai tetapi barang yang sudah dibeli mulai
   * datang: tahap verifikasi ikut berjalan bersamaan.
   */
  isVerificationStarted: boolean;
  /** "Tahap 3 dari 4: Pembelian"; kosong bila dibatalkan. */
  stageText: string;
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

/** Tindakan lanjutan yang tersedia untuk satu pengajuan. */
export interface RestockProgressActions {
  /** Tombol catat barang datang; null bila belum ada barang yang bisa dicatat. */
  receiveLabel: string | null;
  /** Tahap pembelian: link belanja bisa dikirim ke yang belanja. */
  canSendLink: boolean;
  /**
   * Tidak ada tombol lain tetapi sisanya bisa ditutup ("Tutup sisa yang
   * tidak jadi dibeli"), mis. daftar belanja belum ada. Tanpa ini pengajuan
   * macet tanpa petunjuk di tabel.
   */
  canCloseUnpurchased: boolean;
}

const PURCHASE_ORDER_DRAFT = "DRAFT";
/** Status pesanan yang sudah ditutup; tidak ada lagi barang yang ditunggu. */
const FINISHED_ORDER_STATUSES = ["RECEIVED", "CANCELLED"];
/** Sampai jumlah ini kalimat "Datang Sebagian" menyebut unit per barang. */
const MAX_LINES_FOR_UNIT_SENTENCE = 2;

const RECEIVE_LABEL_FIRST = "Catat Barang Datang";
const RECEIVE_LABEL_NEXT = "Catat Kiriman Berikutnya";

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

/** Tahap bawaan tiap status; AWAITING_APPROVAL bisa bergeser ke tahap 1. */
const STAGE_BY_KEY: Record<RestockProgressKey, RestockStageNumber | null> = {
  AWAITING_APPROVAL: 2,
  REJECTED: 2,
  NO_ORDER: 3,
  NOT_PURCHASED: 3,
  PURCHASING: 3,
  PURCHASED: 4,
  PARTIAL: 4,
  COMPLETE: 4,
  COMPLETE_SHORT: 4,
  SERVICE_PENDING: 4,
  CANCELLED: null,
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
    label: "Belum Bisa Dibeli",
    sentence:
      'Daftar belanjanya belum ada, jadi link belanja belum bisa dibuat. Bila barangnya tidak jadi dibeli, tutup pengajuan ini lewat "Tutup sisa yang tidak jadi dibeli".',
  },
  NOT_PURCHASED: {
    label: "Belum Dibeli",
    sentence:
      "Menunggu laporan belanja dari link. Barang baru bisa dicatat datang setelah dilaporkan dibeli.",
  },
  PURCHASING: { label: "Dibeli Sebagian", sentence: "" },
  PURCHASED: {
    label: "Menunggu Barang",
    sentence: "Semua barang sudah dibeli. Catat barangnya saat datang.",
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

/**
 * "Kabel dibeli 6 dari 10 roll, sudah datang 2 roll." Jumlah datang hanya
 * disebut bila sudah ada, supaya yang dibeli dan yang datang tidak tercampur.
 */
function describePurchasingLine(item: PurchaseRequestItem): string {
  const { limit, purchased } = getRestockLinePurchase(item, false);
  const { received } = getRestockLineProgress(item);
  const { nama, satuan } = getLineName(item);
  const arrived = received > 0 ? `, sudah datang ${received} ${satuan}` : "";
  return `${nama} dibeli ${purchased} dari ${limit} ${satuan}${arrived}.`;
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
  const arrivedCount = lines.filter(
    (item) => getRestockLineProgress(item).received > 0,
  ).length;
  const arrivedText =
    arrivedCount > 0 ? ` ${arrivedCount} jenis barang sudah mulai datang.` : "";
  return `${parts.join(", ")}.${arrivedText}`;
}

/** Sisa belanja hanya dilaporkan lewat link belanja. */
const AWAITING_LINK_SUFFIX = " Sisanya menunggu laporan belanja dari link.";
const PURCHASED_CAN_ARRIVE_SUFFIX =
  " Barang yang sudah dibeli bisa dicatat datang.";
const PURCHASED_ALL_ARRIVED_SUFFIX =
  " Barang yang sudah dibeli sudah datang semua.";
const DRAFT_COPY = {
  label: "Belum Diajukan",
  sentence: "Pengajuan belum dikirim ke atasan.",
};
/**
 * Ajakan untuk yang boleh membuat link belanja, ditambahkan di bawah
 * kalimat status. Kalimat status sendiri netral karena dibaca semua orang.
 */
export const SEND_PURCHASE_LINK_HINT =
  "Kirim link belanja ke orang yang belanja.";
/** Pesanan gabungan: belanja tidak dicatat, status ikut barang datang. */
const MERGED_ORDER_SENTENCE =
  "Pengajuan ini digabung dengan pengajuan lain dalam satu pesanan, jadi belanjanya tidak dicatat. Statusnya mengikuti barang yang datang.";
const MERGED_CAN_ARRIVE_SUFFIX = " Barangnya bisa langsung dicatat datang.";

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

/** "Tahap 3 dari 4: Pembelian"; kosong bila tidak ada tahap. */
export function describeRestockStage(stage: RestockStageNumber | null): string {
  if (stage === null) return "";
  return `Tahap ${stage} dari ${RESTOCK_STAGE_COUNT}: ${RESTOCK_STAGE_TITLES[stage]}`;
}

interface ProgressOverrides {
  sentence?: string;
  label?: string;
  stage?: RestockStageNumber | null;
  stoppedStage?: RestockStageNumber | null;
  isVerificationStarted?: boolean;
}

function buildProgress(
  key: RestockProgressKey,
  overrides: ProgressOverrides = {},
): RestockProgress {
  const copy = FIXED_COPY[key];
  const stage =
    overrides.stage === undefined ? STAGE_BY_KEY[key] : overrides.stage;
  return {
    key,
    stage,
    stoppedStage: overrides.stoppedStage ?? null,
    isVerificationStarted: overrides.isVerificationStarted ?? false,
    stageText: describeRestockStage(stage),
    label: overrides.label ?? copy?.label ?? key,
    sentence: overrides.sentence ?? copy?.sentence ?? "",
    badgeClassName: BADGE_CLASS[key],
  };
}

/**
 * Tahap terakhir yang dicapai pengajuan yang dibatalkan: verifikasi bila
 * sudah ada barang datang, pembelian bila sudah disetujui, selain itu
 * persetujuan.
 */
function getCancelledStage(request: PurchaseRequest): RestockStageNumber {
  if (hasRestockReceivedAnything(request) || hasGoodsReceipt(request)) return 4;
  if (request.approvedAt || request.purchaseOrder) return 3;
  return 2;
}

function buildCancelledProgress(request: PurchaseRequest): RestockProgress {
  return buildProgress("CANCELLED", {
    stoppedStage: getCancelledStage(request),
  });
}

/**
 * Satu baris status untuk PDF dan pembaca layar:
 * "Tahap 3 dari 4 (Pembelian): Belum Dibeli".
 */
export function describeRestockStatusLine(progress: RestockProgress): string {
  if (progress.stage === null) return progress.label;
  return `Tahap ${progress.stage} dari ${RESTOCK_STAGE_COUNT} (${RESTOCK_STAGE_TITLES[progress.stage]}): ${progress.label}`;
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
  return buildProgress("COMPLETE_SHORT", {
    sentence: describeShortLines(shortLines),
    label: "Selesai, Kurang",
  });
}

/** Pengajuan jasa saja: tidak ada barang untuk dicatat datang. */
function getServiceOnlyProgress(request: PurchaseRequest): RestockProgress {
  const hasPendingService = (request.jasaItems ?? []).some(
    (item) => !isLineRejected(item) && item.statusKonfirmasi === "PENDING",
  );
  if (hasPendingService && request.status !== "RECEIVED") {
    return buildProgress("SERVICE_PENDING");
  }
  return buildProgress("COMPLETE", { sentence: "Semua jasa sudah selesai." });
}

/** Masih ada barang yang sudah dibeli tetapi belum datang. */
function hasPurchasedAwaitingArrival(lines: PurchaseRequestItem[]): boolean {
  return lines.some((item) => {
    const { purchased } = getRestockLinePurchase(item, false);
    return purchased > getRestockLineProgress(item).received;
  });
}

/**
 * Tahap pembelian masih berjalan (lewat link). Barang yang sudah dibeli dan
 * sudah datang ikut disebut, dan tahap verifikasi ditandai ikut berjalan.
 */
function getPurchasingProgress(
  lines: PurchaseRequestItem[],
  hasArrivals: boolean,
): RestockProgress {
  const arrivalSuffix = hasPurchasedAwaitingArrival(lines)
    ? PURCHASED_CAN_ARRIVE_SUFFIX
    : PURCHASED_ALL_ARRIVED_SUFFIX;
  return buildProgress("PURCHASING", {
    sentence: `${describePurchasingProgress(lines)}${AWAITING_LINK_SUFFIX}${arrivalSuffix}`,
    isVerificationStarted: hasArrivals,
  });
}

/**
 * Belum ada barang datang: status mengikuti belanja yang dicatat lewat link.
 * Pesanan gabungan tidak punya link dan barangnya boleh langsung dicatat
 * datang, jadi langsung berada di tahap verifikasi ("Menunggu Barang").
 */
function getNotYetArrivedProgress(
  request: PurchaseRequest,
  lines: PurchaseRequestItem[],
  purchaseState: RestockPurchaseState,
): RestockProgress {
  if (isRestockMergedOrder(request)) {
    return buildProgress("PURCHASED", {
      sentence: `${MERGED_ORDER_SENTENCE}${MERGED_CAN_ARRIVE_SUFFIX}`,
    });
  }
  const key = PURCHASE_STATE_PROGRESS[purchaseState];
  if (key === "PURCHASING") return getPurchasingProgress(lines, false);
  return buildProgress(key);
}

function getOngoingProgress(request: PurchaseRequest): RestockProgress {
  // Pesanan bisa ditutup/dibatalkan tanpa pengajuan ini ikut berubah (data
  // lama atau pesanan gabungan); tombol catat akan selalu ditolak server.
  const orderStatus = request.purchaseOrder?.status;
  if (orderStatus === "CANCELLED") return buildCancelledProgress(request);
  const lines = getReceivableLines(request);
  if (orderStatus === "RECEIVED") return getFinishedProgress(lines);

  const hasReceived = lines.some(
    (item) => getRestockLineProgress(item).received > 0,
  );
  const purchaseState = getRestockPurchaseState(request);
  if (!hasReceived) {
    return getNotYetArrivedProgress(request, lines, purchaseState);
  }
  const hasOutstanding = lines.some(
    (item) => getRestockLineProgress(item).remaining > 0,
  );
  if (!hasOutstanding) return getFinishedProgress(lines);
  const isStillPurchasing =
    purchaseState !== "ALL" && !canRestockReceiveWithoutPurchaseReport(request);
  if (isStillPurchasing) return getPurchasingProgress(lines, true);
  return buildProgress("PARTIAL", {
    sentence: describePartialProgress(lines),
    label: "Datang Sebagian",
  });
}

/** Status turunan satu pengajuan beserta kalimat penjelasnya. */
export function getRestockProgress(request: PurchaseRequest): RestockProgress {
  switch (request.status) {
    case "DRAFT":
      return buildProgress("AWAITING_APPROVAL", {
        sentence: DRAFT_COPY.sentence,
        label: DRAFT_COPY.label,
        stage: 1,
      });
    case "SUBMITTED":
      return buildProgress("AWAITING_APPROVAL");
    case "REJECTED":
      return buildProgress("REJECTED", { stoppedStage: 2 });
    case "CANCELLED":
      return buildCancelledProgress(request);
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

/**
 * Tombol lanjutan satu pengajuan. Catat barang datang hanya muncul bila ada
 * barang yang sudah dilaporkan dibeli tapi belum datang (atau pada data lama
 * dan pesanan gabungan, bila masih ada sisa). Link belanja muncul selama
 * tahap pembelian belum selesai.
 */
export function getRestockProgressActions(
  request: PurchaseRequest,
): RestockProgressActions {
  const canSendLink = canSendRestockPurchaseLink(request);
  if (!hasRestockItemsAwaitingArrival(request)) {
    return {
      receiveLabel: null,
      canSendLink,
      canCloseUnpurchased: !canSendLink && canCloseRestockUnpurchased(request),
    };
  }
  return {
    receiveLabel: hasRestockReceivedAnything(request)
      ? RECEIVE_LABEL_NEXT
      : RECEIVE_LABEL_FIRST,
    canSendLink,
    canCloseUnpurchased: false,
  };
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

const AWAITING_PURCHASE_REPORT_LABEL =
  "Tahap pembelian: menunggu laporan belanja dari link";
const MERGED_PURCHASE_STEP_LABEL = "Belanja pesanan gabungan tidak dicatat";
const NO_ORDER_PURCHASE_STEP_LABEL = "Daftar belanja belum ada";

function getBoughtAtOnceLabel(issuedAt: string | null): string {
  return issuedAt
    ? `Sudah dibeli semua ${formatRestockDate(issuedAt)} (dicatat sekaligus)`
    : "Sudah dibeli semua (tanggal tidak tercatat)";
}

/** Langkah pembelian yang belum selesai; label menurut keadaannya. */
function describePendingPurchaseLabel(
  request: PurchaseRequest,
  state: RestockPurchaseState,
  isFinished: boolean,
): string {
  if (state === "PARTIAL") return "Masih ada barang yang belum dibeli";
  if (isFinished) return "Tidak jadi dibeli";
  if (!request.purchaseOrder) return NO_ORDER_PURCHASE_STEP_LABEL;
  return AWAITING_PURCHASE_REPORT_LABEL;
}

/**
 * Langkah pembelian di riwayat di luar tiap catatan belanja. null bila semua
 * sudah tergambar lewat catatan belanja, atau pesanan sudah ditutup setelah
 * sebagian dibeli (kirimannya yang bercerita). Pesanan gabungan tidak punya
 * link, jadi langkahnya hanya menjelaskan bahwa belanjanya tidak dicatat.
 */
export function getRestockPurchaseStep(
  request: PurchaseRequest,
): RestockPurchaseStep | null {
  const order = request.purchaseOrder;
  const processedByName = order?.processedBy?.name ?? null;
  const hasRecords = getRestockPurchaseRecords(request).length > 0;
  const isFinished = isRestockOrderFinished(request);
  const state = getRestockPurchaseState(request);

  if (hasRecords && state === "ALL") return null;
  if (!hasRecords && isRestockMergedOrder(request)) {
    return {
      isDone: true,
      label: MERGED_PURCHASE_STEP_LABEL,
      issuedAt: null,
      processedByName: null,
    };
  }
  if (state === "ALL") {
    const issuedAt = order?.issuedAt ?? null;
    return {
      isDone: true,
      label: getBoughtAtOnceLabel(issuedAt),
      issuedAt,
      processedByName,
    };
  }
  if (state === "PARTIAL" && isFinished) return null;
  return {
    isDone: false,
    label: describePendingPurchaseLabel(request, state, isFinished),
    issuedAt: null,
    processedByName,
  };
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
