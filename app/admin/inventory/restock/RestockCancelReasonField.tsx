"use client";

import { FiSlash, FiX } from "react-icons/fi";

/** Alasan siap pakai untuk barang yang tidak jadi dibelikan. */
export const RESTOCK_CANCEL_REASONS = [
  "Tidak dibelikan",
  "Stok supplier kosong",
  "Harga tidak sesuai",
  "Dibatalkan pemesan",
] as const;

const OTHER_REASON_VALUE = "__lainnya__";

interface RestockCancelReasonFieldProps {
  itemName: string;
  satuan: string;
  remainingQuantity: number;
  /** null = tidak dianulir, "" = ditandai anulir tapi alasan belum diisi. */
  reason: string | null;
  onReasonChange: (reason: string | null) => void;
}

/**
 * Kontrol anulir sisa pesanan satu item: tandai barang tidak jadi dibelikan
 * dan wajib sertakan alasannya.
 */
export function RestockCancelReasonField({
  itemName,
  satuan,
  remainingQuantity,
  reason,
  onReasonChange,
}: RestockCancelReasonFieldProps) {
  const isCancelled = reason !== null;
  const isPresetReason = RESTOCK_CANCEL_REASONS.some(
    (preset) => preset === reason,
  );
  const selectValue = isPresetReason
    ? (reason as string)
    : reason
      ? OTHER_REASON_VALUE
      : "";

  if (!isCancelled) {
    return (
      <button
        type="button"
        onClick={() => onReasonChange("")}
        className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400"
      >
        <FiSlash />
        Anulir sisa {remainingQuantity} {satuan} — tidak dibelikan
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
          Anulir {remainingQuantity} {satuan}
        </span>
        <button
          type="button"
          aria-label={`Batalkan anulir ${itemName}`}
          onClick={() => onReasonChange(null)}
          className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-700"
        >
          <FiX /> Batal
        </button>
      </div>

      <select
        aria-label={`Alasan anulir ${itemName}`}
        value={selectValue}
        onChange={(event) =>
          onReasonChange(
            event.target.value === OTHER_REASON_VALUE ? "" : event.target.value,
          )
        }
        className="mt-2 w-full rounded-xl border-none bg-white px-3 py-2 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 dark:bg-gray-900 dark:text-gray-200"
      >
        <option value="">Pilih alasan...</option>
        {RESTOCK_CANCEL_REASONS.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
        <option value={OTHER_REASON_VALUE}>Lainnya...</option>
      </select>

      {!isPresetReason && (
        <input
          type="text"
          maxLength={255}
          aria-label={`Alasan lain anulir ${itemName}`}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Tulis alasan anulir..."
          className="mt-2 w-full rounded-xl border-none bg-white px-3 py-2 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-rose-500 dark:bg-gray-900 dark:text-gray-200"
        />
      )}

      {reason.trim().length === 0 && (
        <div className="mt-2 text-[11px] font-bold text-rose-600 dark:text-rose-400">
          Alasan anulir wajib diisi.
        </div>
      )}
    </div>
  );
}
