"use client";

import { Combobox } from "@/components/ui/Combobox";

interface BarangSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  onSearch: (query: string) => void;
  loading: boolean;
  disabled?: boolean;
  lockedNote?: string;
  label?: string;
}

export function BarangSelector({
  value,
  onChange,
  options,
  onSearch,
  loading,
  disabled,
  lockedNote,
  label = "Barang *",
}: BarangSelectorProps) {
  return (
    <div className="flex flex-col">
      <label
        htmlFor="barangId"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
      </label>
      <Combobox
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Cari & pilih barang..."
        disabled={disabled}
        onSearch={onSearch}
        loading={loading}
        className="w-full"
      />
      {lockedNote && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {lockedNote}
        </p>
      )}
    </div>
  );
}
