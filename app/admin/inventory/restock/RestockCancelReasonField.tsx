"use client";

import { FiRotateCcw } from "react-icons/fi";

import { RestockNotComingReasonSelect } from "./RestockNotComingReasonSelect";

interface RestockCancelReasonFieldProps {
  itemName: string;
  satuan: string;
  remainingQuantity: number;
  /** null = masih ditunggu, "" = ditandai tidak datang tapi alasan belum diisi. */
  reason: string | null;
  onReasonChange: (reason: string | null) => void;
}

/**
 * Tanda "sisa barang ini tidak akan datang" untuk satu barang, lengkap dengan
 * alasan wajib dan jalan kembali bila ternyata barangnya masih datang.
 */
export function RestockCancelReasonField({
  itemName,
  satuan,
  remainingQuantity,
  reason,
  onReasonChange,
}: RestockCancelReasonFieldProps) {
  if (reason === null) {
    return (
      <div>
        <button
          type="button"
          onClick={() => onReasonChange("")}
          aria-label={`Sisa ${remainingQuantity} ${satuan} ini tidak akan datang? (${itemName})`}
          className="min-h-[44px] text-left text-sm font-semibold text-orange-800 underline underline-offset-2 hover:text-orange-900 dark:text-orange-300 sm:min-h-0"
        >
          Sisa {remainingQuantity} {satuan} ini tidak akan datang?
        </button>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Tekan hanya kalau sisa barang ini pasti tidak dikirim. Kalau masih
          akan datang, biarkan saja.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-950/20">
      <p className="text-sm font-bold text-orange-900 dark:text-orange-200">
        {remainingQuantity} {satuan} {itemName} tidak akan datang
      </p>
      <RestockNotComingReasonSelect
        itemName={itemName}
        reason={reason}
        onReasonChange={onReasonChange}
      />
      <button
        type="button"
        aria-label={`Ternyata masih datang (${itemName})`}
        onClick={() => onReasonChange(null)}
        className="flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-gray-700 hover:text-gray-900 dark:text-gray-300 sm:min-h-0"
      >
        <FiRotateCcw aria-hidden="true" /> Ternyata masih datang
      </button>
    </div>
  );
}
