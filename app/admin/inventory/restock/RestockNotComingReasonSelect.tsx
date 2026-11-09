"use client";

import { useId, useState } from "react";

import {
  RESTOCK_NOT_COMING_REASONS,
  RESTOCK_OTHER_REASON_OPTION,
  getNotComingReasonSelectValue,
  isPresetNotComingReason,
} from "./restockReceiveForm";

interface RestockNotComingReasonSelectProps {
  /** Nama barang untuk aria-label; kosong bila alasan berlaku ke semua sisa. */
  itemName?: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  /** Pertanyaan di atas pilihan; bawaan "Kenapa tidak datang". */
  question?: string;
}

const DEFAULT_QUESTION = "Kenapa tidak datang";

/**
 * Pilihan "Kenapa tidak datang?". Kolom tulis sendiri hanya muncul setelah
 * "Lainnya" dipilih, dan pilihan itu tetap terpilih selama teksnya diketik.
 */
export function RestockNotComingReasonSelect({
  itemName,
  reason,
  onReasonChange,
  question = DEFAULT_QUESTION,
}: RestockNotComingReasonSelectProps) {
  const selectId = useId();
  const [isOtherSelected, setIsOtherSelected] = useState(
    reason.length > 0 && !isPresetNotComingReason(reason),
  );
  const selectValue = getNotComingReasonSelectValue(reason, isOtherSelected);
  const isOtherVisible = selectValue === RESTOCK_OTHER_REASON_OPTION.value;
  const suffix = itemName ? ` untuk ${itemName}` : "";

  const handleSelectChange = (value: string) => {
    const isOther = value === RESTOCK_OTHER_REASON_OPTION.value;
    setIsOtherSelected(isOther);
    onReasonChange(isOther ? "" : value);
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={selectId}
        className="block text-sm font-bold text-gray-800 dark:text-gray-100"
      >
        {question}?
      </label>
      <select
        id={selectId}
        aria-label={`${question}${suffix}`}
        value={selectValue}
        onChange={(event) => handleSelectChange(event.target.value)}
        className="min-h-[44px] w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-orange-500 dark:border-orange-900/50 dark:bg-gray-900 dark:text-gray-100"
      >
        <option value="">Pilih alasan…</option>
        {RESTOCK_NOT_COMING_REASONS.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
        <option value={RESTOCK_OTHER_REASON_OPTION.value}>
          {RESTOCK_OTHER_REASON_OPTION.label}
        </option>
      </select>

      {isOtherVisible && (
        <input
          type="text"
          maxLength={255}
          aria-label={`Tulis alasan tidak datang${suffix}`}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Tulis alasannya…"
          className="min-h-[44px] w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-orange-500 dark:border-orange-900/50 dark:bg-gray-900 dark:text-gray-100"
        />
      )}

      {reason.trim().length === 0 && (
        <p className="text-xs font-bold text-red-700 dark:text-red-300">
          Alasannya wajib diisi.
        </p>
      )}
    </div>
  );
}
