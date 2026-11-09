import { parseRupiahInput, todayIsoDate } from "@/lib/utils/purchase-input";
import { RESTOCK_PURCHASE_LIMITS } from "@/lib/validations/restock";

import { isLineRejected } from "./approvalUtils";
import {
  getRestockLinePurchase,
  isRestockLegacyPurchased,
} from "./restockPurchase";
import type { PurchaseRequest, RestockPurchaseRecordPayload } from "./types";

export { todayIsoDate };

/** Satu baris barang di isian "Catat Belanja". */
export interface PurchaseFormLine {
  purchaseOrderItemId: string;
  nama: string;
  satuan: string;
  remainingToBuy: number;
  isChecked: boolean;
  /** Angka yang diketik; 0 berarti kosong. */
  quantity: number;
  /** Teks harga yang diketik; kosong berarti tidak diisi. */
  unitPrice: string;
}

/** Isian lengkap modal "Catat Belanja". */
export interface PurchaseForm {
  storeName: string;
  /** "YYYY-MM-DD". */
  purchasedAt: string;
  notes: string;
  /** Nama yang belanja; kosong berarti nama pencatat. */
  buyerName: string;
  lines: PurchaseFormLine[];
}

/**
 * Baris isian dari barang pengajuan. Baris ditolak dan baris tanpa daftar
 * belanja dilewati; dua baris yang menunjuk barang pesanan yang sama digabung.
 * Barang yang sudah dibeli semua tetap tampil (nonaktif).
 */
export function buildPurchaseFormLines(
  request: PurchaseRequest,
): PurchaseFormLine[] {
  const isLegacy = isRestockLegacyPurchased(request);
  const seen = new Set<string>();
  const lines: PurchaseFormLine[] = [];
  for (const item of request.items) {
    const purchaseOrderItemId = item.purchaseOrderItemId;
    if (isLineRejected(item) || !purchaseOrderItemId) continue;
    if (seen.has(purchaseOrderItemId)) continue;
    seen.add(purchaseOrderItemId);
    const { remainingToBuy } = getRestockLinePurchase(item, isLegacy);
    lines.push({
      purchaseOrderItemId,
      nama: item.barang?.nama ?? "Barang",
      satuan: item.barang?.satuan ?? "",
      remainingToBuy,
      isChecked: false,
      quantity: remainingToBuy,
      unitPrice: "",
    });
  }
  return lines;
}

/** "Semua barang dibeli di toko ini": centang semua sisa dengan jumlah penuh. */
export function selectAllPurchaseLines(
  lines: PurchaseFormLine[],
): PurchaseFormLine[] {
  return lines.map((line) =>
    line.remainingToBuy > 0
      ? { ...line, isChecked: true, quantity: line.remainingToBuy }
      : line,
  );
}

function findLineProblem(line: PurchaseFormLine): string | null {
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    return `${line.nama}: jumlah dibeli paling sedikit 1.`;
  }
  if (line.quantity > line.remainingToBuy) {
    const satuan = line.satuan ? ` ${line.satuan}` : "";
    return `${line.nama}: tinggal ${line.remainingToBuy}${satuan} yang belum dibeli. Isi paling banyak ${line.remainingToBuy}.`;
  }
  const price = parseRupiahInput(line.unitPrice);
  if (Number.isNaN(price)) {
    return `${line.nama}: harga tidak terbaca. Tulis angka saja, contoh 12000.`;
  }
  if (price !== null && price > RESTOCK_PURCHASE_LIMITS.unitPrice) {
    return `${line.nama}: harga terlalu besar. Periksa lagi angkanya.`;
  }
  return null;
}

/** Alasan isian belum bisa disimpan, urut dari atas ke bawah. */
export function findPurchaseFormProblems(
  form: PurchaseForm,
  now: Date = new Date(),
): string[] {
  const problems: string[] = [];
  if (form.storeName.trim() === "") {
    problems.push("Nama toko belum diisi. Tulis nama tokonya.");
  }
  if (form.purchasedAt === "") {
    problems.push("Tanggal belanja belum diisi.");
  } else if (form.purchasedAt > todayIsoDate(now)) {
    problems.push("Tanggal belanja tidak boleh di hari yang akan datang.");
  }
  const checked = form.lines.filter((line) => line.isChecked);
  if (checked.length === 0) {
    problems.push(
      "Belum ada barang yang dicentang. Centang barang yang dibeli di toko ini.",
    );
  }
  for (const line of checked) {
    const problem = findLineProblem(line);
    if (problem) problems.push(problem);
  }
  return problems;
}

/** Body POST belanja dari isian yang sudah lolos pemeriksaan. */
export function toPurchaseRecordPayload(
  form: PurchaseForm,
  fotoNota: string[],
): RestockPurchaseRecordPayload {
  const notes = form.notes.trim();
  const buyerName = form.buyerName.trim();
  return {
    storeName: form.storeName.trim(),
    purchasedAt: form.purchasedAt,
    notes: notes === "" ? null : notes,
    buyerName: buyerName === "" ? null : buyerName,
    fotoNota,
    items: form.lines
      .filter((line) => line.isChecked)
      .map((line) => ({
        purchaseOrderItemId: line.purchaseOrderItemId,
        quantity: line.quantity,
        unitPrice: parseRupiahInput(line.unitPrice),
      })),
  };
}
