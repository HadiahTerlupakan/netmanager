import type { RestockReceiveInput } from "@/lib/validations/restock";
import { hasRestockEnteredAnything } from "@/modules/inventory/client";

import type {
  Barang,
  PurchaseRequest,
  PurchaseRequestItem,
  RestockOverReceiptMap,
  RestockSubstitutionMap,
} from "./types";
import {
  buildOverReceiptPayload,
  buildSubstitutionPayload,
  getRestockEnterableItems,
  getRestockEntryBasis,
  getRestockItemRemaining,
  hasMissingOverReceiptReason,
} from "./utils";

/**
 * Aturan modal "Masukkan Barang": satu kali simpan selalu menyelesaikan
 * pengajuan yang sudah disetujui. Barang yang diisi masuk gudang; sisa
 * patokan tiap baris ({@link getRestockEntryBasis}) yang tidak diisi tidak
 * dimasukkan.
 */

/** Teks tombol dan judul modal untuk memasukkan barang pengajuan ke gudang. */
export const ENTER_GOODS_LABEL = "Masukkan Barang";

export const NOTHING_ENTERED_MESSAGE =
  "Isi jumlah barang yang masuk, paling sedikit satu. Kalau tidak ada barang yang masuk, tutup jendela ini lalu tekan Batalkan Pengajuan.";
export const PHOTO_MISSING_MESSAGE = "Foto barang yang masuk dulu.";
export const OVER_RECEIPT_REASON_MISSING_MESSAGE =
  "Tulis alasan barang yang masuk lebih banyak dari sisa pesanan.";

export interface RestockReceiveLine {
  barangId: string;
  nama: string;
  satuan: string;
  quantity: number;
}

export interface RestockReceiveSummary {
  /** Barang yang masuk gudang saat disimpan. */
  entering: RestockReceiveLine[];
  /** Sisa patokan yang tidak dimasukkan; pengajuan tetap selesai. */
  notEntered: RestockReceiveLine[];
  /** Ada jumlah yang diisi; foto bukti wajib. */
  hasEntry: boolean;
  /**
   * Pengajuan sudah pernah menerima sesuatu, jadi semua jumlah 0 boleh:
   * pengajuan diselesaikan tanpa barang tambahan (aturan server yang sama).
   */
  hasEnteredBefore: boolean;
}

export interface RestockReceiveFormInput {
  request: PurchaseRequest;
  receivedItems: Record<string, number>;
  substitutions: RestockSubstitutionMap;
  barangs: Barang[];
}

export interface RestockReceiveProblemInput extends RestockReceiveFormInput {
  overReceipts: RestockOverReceiptMap;
  photoCount: number;
}

export interface RestockReceivePayloadInput extends RestockReceiveFormInput {
  overReceipts: RestockOverReceiptMap;
  fotoBukti: string[];
}

/** Sampai jumlah ini pesan menyebut nama barang yang tidak dimasukkan. */
const MAX_NOT_ENTERED_LINES_NAMED = 2;

function getEnteredQuantity(
  item: PurchaseRequestItem,
  receivedItems: Record<string, number>,
): number {
  return Math.max(receivedItems[item.barangId] ?? 0, 0);
}

/**
 * Jumlah masuk yang boleh diisi untuk satu baris. Tanpa izin mengubah
 * pesanan (`purchase_orders:update`) jumlahnya dibatasi sisa pesanan, karena
 * kelebihan barang menambah isi pesanan dan server menolaknya.
 */
export function clampEnteredQuantity(
  item: PurchaseRequestItem,
  quantity: number,
  canOverReceive: boolean,
): number {
  const nonNegative = Math.max(quantity, 0);
  if (canOverReceive) return nonNegative;
  return Math.min(nonNegative, getRestockItemRemaining(item));
}

/** Bagian patokan baris yang tidak ikut dimasukkan dengan jumlah ini. */
export function getNotEnteredQuantity(
  entryBasis: number,
  enteredQuantity: number,
): number {
  return Math.max(entryBasis - enteredQuantity, 0);
}

function findReplacement(
  item: PurchaseRequestItem,
  input: RestockReceiveFormInput,
): Barang | undefined {
  const replacementId = input.substitutions[item.barangId];
  if (!replacementId) return undefined;
  return input.barangs.find((barang) => barang.id === replacementId);
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

/**
 * Ringkasan isian: barang yang masuk gudang (dengan nama barang pengganti
 * bila diganti) dan sisa yang tidak dimasukkan.
 */
export function getRestockReceiveSummary(
  input: RestockReceiveFormInput,
): RestockReceiveSummary {
  const entering: RestockReceiveLine[] = [];
  const notEntered: RestockReceiveLine[] = [];

  for (const item of getRestockEnterableItems(input.request)) {
    const entered = getEnteredQuantity(item, input.receivedItems);
    if (entered > 0) {
      entering.push(toLine(item, entered, findReplacement(item, input)));
    }
    const notEnteredQuantity = getNotEnteredQuantity(
      getRestockEntryBasis(item, input.request),
      entered,
    );
    if (notEnteredQuantity > 0) {
      notEntered.push(toLine(item, notEnteredQuantity));
    }
  }

  return {
    entering,
    notEntered,
    hasEntry: entering.length > 0,
    hasEnteredBefore: hasRestockEnteredAnything(input.request),
  };
}

/**
 * Hal yang membuat isian belum bisa disimpan, dalam kalimat untuk petugas.
 * Daftar kosong berarti tombol simpan aktif. Semua jumlah 0 hanya boleh pada
 * pengajuan lama yang sudah pernah menerima barang (selesai tanpa barang
 * tambahan, tanpa foto) — sama dengan aturan server.
 */
export function getRestockReceiveProblems(
  input: RestockReceiveProblemInput,
): string[] {
  const summary = getRestockReceiveSummary(input);
  const problems: string[] = [];

  if (!summary.hasEntry && !summary.hasEnteredBefore) {
    problems.push(NOTHING_ENTERED_MESSAGE);
  }
  if (summary.hasEntry && input.photoCount === 0) {
    problems.push(PHOTO_MISSING_MESSAGE);
  }
  const hasMissingReason = hasMissingOverReceiptReason(
    getRestockEnterableItems(input.request),
    input.receivedItems,
    input.overReceipts,
  );
  if (hasMissingReason) problems.push(OVER_RECEIPT_REASON_MISSING_MESSAGE);
  return problems;
}

/**
 * Body PATCH Masukkan Barang. Kunci `items` tepat baris yang masih punya
 * sisa; barang pengganti hanya dikirim untuk barang yang benar-benar masuk.
 */
export function buildRestockReceivePayload(
  input: RestockReceivePayloadInput,
): RestockReceiveInput {
  const enterableItems = getRestockEnterableItems(input.request);
  const items = Object.fromEntries(
    enterableItems.map((item) => [
      item.barangId,
      getEnteredQuantity(item, input.receivedItems),
    ]),
  );
  const substitutions = Object.fromEntries(
    Object.entries(buildSubstitutionPayload(input.substitutions)).filter(
      ([barangId]) => (items[barangId] ?? 0) > 0,
    ),
  );
  const hasEntry = Object.values(items).some((quantity) => quantity > 0);
  return {
    items,
    substitutions,
    overReceipts: buildOverReceiptPayload(
      enterableItems,
      input.receivedItems,
      input.overReceipts,
    ),
    fotoBukti: hasEntry ? input.fotoBukti : [],
  };
}

/**
 * Label tombol simpan. "Selesaikan tanpa barang tambahan" hanya untuk
 * pengajuan lama yang sudah pernah menerima barang dan kini diisi 0 semua;
 * pengajuan yang belum pernah menerima apa pun tetap "Simpan ke Gudang"
 * (tombolnya mati sampai ada jumlah yang diisi).
 */
export function getRestockReceiveSubmitLabel(
  summary: RestockReceiveSummary,
): string {
  return !summary.hasEntry && summary.hasEnteredBefore
    ? "Selesaikan tanpa barang tambahan"
    : "Simpan ke Gudang";
}

/** "Kabel Fiber 4 roll, ONT 2 pcs". */
export function describeRestockReceiveLines(
  lines: RestockReceiveLine[],
): string {
  return lines
    .map((line) => `${line.nama} ${line.quantity} ${line.satuan}`)
    .join(", ");
}

/** Konfirmasi hanya diminta bila ada barang yang masuk kurang dari sisanya. */
export function needsRestockShortfallConfirm(
  summary: RestockReceiveSummary,
): boolean {
  return summary.notEntered.length > 0;
}

/** Kalimat dialog konfirmasi kekurangan sebelum pengajuan diselesaikan. */
export function getRestockShortfallConfirmMessage(
  summary: RestockReceiveSummary,
): string {
  return `${describeRestockReceiveLines(summary.notEntered)} tidak dimasukkan dan pengajuan selesai. Lanjutkan?`;
}

function describeNotEntered(summary: RestockReceiveSummary): string {
  return summary.notEntered.length > MAX_NOT_ENTERED_LINES_NAMED
    ? `${summary.notEntered.length} jenis barang tidak dimasukkan.`
    : `Tidak dimasukkan: ${describeRestockReceiveLines(summary.notEntered)}.`;
}

/** Toast sukses sesudah barang dimasukkan dan pengajuan selesai. */
export function getRestockReceiveSuccessMessage(
  summary: RestockReceiveSummary,
): string {
  if (!summary.hasEntry) {
    return "Tersimpan. Pengajuan selesai tanpa barang tambahan.";
  }
  if (summary.notEntered.length === 0) {
    return "Tersimpan. Semua barang sudah masuk gudang.";
  }
  return `Tersimpan. Barang sudah masuk gudang. ${describeNotEntered(summary)}`;
}
