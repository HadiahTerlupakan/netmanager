"use client";

import { getKondisiColor } from "@/lib/utils/inventory-helpers";

export type Kondisi = "BARU" | "BEKAS" | "RUSAK";

interface KondisiSelectorProps {
  value: Kondisi;
  onChange: (value: Kondisi) => void;
  disabled?: boolean;
  lockedNote?: string;
  label?: string;
}

const KONDISI_DESCRIPTION: Record<Kondisi, string> = {
  BARU: "Baru - Siap pakai",
  BEKAS: "Bekas - Pernah dipakai",
  RUSAK: "Rusak - Perlu perbaikan",
};

export function KondisiSelector({
  value,
  onChange,
  disabled,
  lockedNote,
  label = "Kondisi Barang *",
}: KondisiSelectorProps) {
  return (
    <div>
      <label
        htmlFor="kondisi"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
      </label>
      <select
        id="kondisi"
        name="kondisi"
        value={value}
        onChange={(event) => onChange(event.target.value as Kondisi)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        disabled={disabled}
      >
        <option value="BARU">Baru</option>
        <option value="BEKAS">Bekas</option>
        <option value="RUSAK">Rusak</option>
      </select>
      <div className="mt-1">
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getKondisiColor(
            value,
          )}`}
        >
          {KONDISI_DESCRIPTION[value]}
        </span>
      </div>
      {lockedNote && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {lockedNote}
        </p>
      )}
    </div>
  );
}
