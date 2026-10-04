"use client";

import { useState } from "react";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { useDebounce } from "@/hooks/useDebounce";
import { useApi } from "@/lib/hooks/useApi";

/**
 * Pencarian karyawan untuk ditunjuk sebagai penanda tangan internal.
 * Karyawan terpilih menandatangani lewat aplikasi mobile, tanpa tautan.
 */

export interface SignerEmployeeOption {
  userId: string;
  name: string;
  role: string | null;
  email: string;
  phone: string | null;
}

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

export default function SignerEmployeePicker({
  excludedUserIds,
  onSelect,
}: {
  excludedUserIds: string[];
  onSelect: (option: SignerEmployeeOption) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword.trim(), SEARCH_DEBOUNCE_MS);
  const isSearchable = debouncedKeyword.length >= MIN_SEARCH_LENGTH;

  const { data, isLoading } = useApi<{ options: SignerEmployeeOption[] }>(
    isSearchable
      ? `/api/admin/endorsements/signer-options?search=${encodeURIComponent(debouncedKeyword)}`
      : null,
  );
  const options = (data?.options ?? []).filter(
    (option) => !excludedUserIds.includes(option.userId),
  );

  const choose = (option: SignerEmployeeOption) => {
    onSelect(option);
    setKeyword("");
  };

  return (
    <div className="relative">
      <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
      <input
        type="search"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        className={INPUT_CLASS}
        placeholder="Cari karyawan (nama, email, atau telepon)"
        aria-label="Cari karyawan untuk penanda tangan"
      />
      {isSearchable && keyword.trim() && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {isLoading && (
            <li className="px-3 py-2 text-sm text-gray-500">Mencari...</li>
          )}
          {!isLoading && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">
              Tidak ada karyawan yang cocok
            </li>
          )}
          {options.map((option) => (
            <li key={option.userId}>
              <button
                type="button"
                onClick={() => choose(option)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {[option.role, option.email].filter(Boolean).join(" · ")}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
