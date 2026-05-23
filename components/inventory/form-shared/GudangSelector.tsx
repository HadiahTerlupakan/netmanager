"use client";

import type { GudangOption } from "./useGudangOptions";

interface GudangSelectorProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  gudangs: GudangOption[];
  disabled?: boolean;
  lockedNote?: string;
  label?: string;
  placeholder?: string;
}

export function GudangSelector({
  id = "gudangId",
  name = "gudangId",
  value,
  onChange,
  gudangs,
  disabled,
  lockedNote,
  label = "Gudang *",
  placeholder = "Pilih gudang",
}: GudangSelectorProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {gudangs.map((gudang) => (
          <option key={gudang.id} value={gudang.id}>
            {gudang.kode} - {gudang.nama}
          </option>
        ))}
      </select>
      {lockedNote && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {lockedNote}
        </p>
      )}
    </div>
  );
}
