"use client";

import React, { useMemo, useRef, useState } from "react";
import { HiChevronDown, HiXMark } from "react-icons/hi2";
import { useClickOutside } from "@/hooks/useClickOutside";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  noResultLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

/**
 * Pemilih berbasis pasangan nilai–label dengan pencarian ketik.
 *
 * Berbeda dari `SearchableDropdown`, yang nilainya adalah teks yang diketik
 * pengguna: komponen ini selalu menghasilkan `value` dari salah satu opsi.
 * Perbedaan itu penting untuk field yang menjadi foreign key -- mengetik teks
 * bebas di sana akan menghasilkan id yang tidak ada.
 *
 * Dibuat untuk daftar panjang: pemilihan ODP menampilkan ratusan entri, dan
 * `<select>` biasa memanjang ke bawah tanpa cara menyaring.
 */
const MAX_VISIBLE_OPTIONS = 50;

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Cari lalu pilih...",
  emptyLabel = "Belum ada pilihan",
  noResultLabel = "Tidak ada yang cocok",
  disabled = false,
  id,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id ?? "searchable-select"}-listbox`;

  useClickOutside(wrapperRef, () => setIsOpen(false));

  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(keyword),
    );
  }, [options, query]);

  // Daftar dipotong supaya mengetik satu huruf pada ratusan opsi tidak
  // memaksa render seluruhnya. Sisanya tetap terjangkau lewat pencarian.
  const visible = filtered.slice(0, MAX_VISIBLE_OPTIONS);
  const hiddenCount = filtered.length - visible.length;

  const open = () => {
    if (disabled) return;
    setQuery("");
    setIsOpen(true);
  };

  const pick = (option: SearchableSelectOption) => {
    onChange(option.value);
    setIsOpen(false);
    setQuery("");
  };

  const clear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange("");
    setQuery("");
  };

  const inputClassName =
    "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 pr-16 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-60";

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        className={inputClassName}
        placeholder={options.length === 0 ? emptyLabel : placeholder}
        // Saat tertutup input menampilkan label pilihan; saat terbuka ia
        // menjadi kotak pencarian yang kosong agar bisa langsung diketik.
        value={isOpen ? query : (selected?.label ?? "")}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={open}
        onClick={open}
      />

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {selected && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label="Kosongkan pilihan"
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <HiXMark className="w-4 h-4" />
          </button>
        )}
        <HiChevronDown className="w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
        >
          {visible.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {options.length === 0 ? emptyLabel : noResultLabel}
            </p>
          ) : (
            <>
              {visible.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => pick(option)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/30 ${
                    option.value === value
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              {hiddenCount > 0 && (
                <p className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
                  {hiddenCount} lainnya — ketik untuk mempersempit
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
