"use client";

import {
  describeApprovalStock,
  type ApprovalStockTone,
} from "./restockApprovalStock";
import type { RestockApprovalStockState } from "./useRestockApprovalStock";

/** Warna kesimpulan; teks berkontras ≥4.5:1 terhadap latarnya di dua tema. */
const TONE_CLASS: Record<ApprovalStockTone, string> = {
  danger:
    "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
  enough:
    "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100",
};

const NEUTRAL_CLASS =
  "rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";

interface RestockApprovalStockInfoProps {
  stock: RestockApprovalStockState;
  /** Barang yang akan dibeli: barang pengganti bila diganti. */
  barangId: string;
  /** Jumlah yang sedang dipertimbangkan (jumlah disetujui saat ini). */
  quantity: number;
  satuan: string;
}

/**
 * Stok barang ini di gudang tujuan beserta kondisinya (Baru/Bekas/Rusak) dan
 * kesimpulan dibanding jumlah yang diajukan, sebagai bahan pertimbangan.
 */
export function RestockApprovalStockInfo({
  stock,
  barangId,
  quantity,
  satuan,
}: RestockApprovalStockInfoProps) {
  if (stock.status === "idle") return null;
  if (stock.status === "loading") {
    return (
      <div className={`mt-3 ${NEUTRAL_CLASS}`} role="status">
        Memuat stok gudang…
      </div>
    );
  }
  if (stock.status === "error") {
    return (
      <div
        className={`mt-3 flex flex-wrap items-center gap-2 ${NEUTRAL_CLASS}`}
      >
        <span>{stock.message}</span>
        <button
          type="button"
          onClick={stock.retry}
          className="font-bold text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  const summary = describeApprovalStock(
    stock.byBarangId.get(barangId),
    quantity,
    satuan,
  );
  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2 text-xs ${TONE_CLASS[summary.tone]}`}
      aria-label="Stok di gudang tujuan"
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-bold">{summary.totalText}</span>
        {summary.conditionText && <span>({summary.conditionText})</span>}
      </div>
      <div className="mt-1 font-semibold">{summary.verdict}</div>
      {summary.notes.map((note) => (
        <div key={note} className="mt-1">
          {note}
        </div>
      ))}
    </div>
  );
}
