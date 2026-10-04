"use client";

import { useState } from "react";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { useDebounce } from "@/hooks/useDebounce";
import { useApi } from "@/lib/hooks/useApi";
import type { LegalPartyOption } from "../legal-types";

/** Pencarian pihak kontrak satu jenis (mitra, reseller, pelanggan, vendor, site). */

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

export default function PartyPicker({
  partyType,
  typeLabel,
  onSelect,
}: {
  partyType: string;
  typeLabel: string;
  onSelect: (party: LegalPartyOption) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword.trim(), SEARCH_DEBOUNCE_MS);
  const isSearchable = debouncedKeyword.length >= MIN_SEARCH_LENGTH;
  const { data, isLoading } = useApi<{ options: LegalPartyOption[] }>(
    isSearchable
      ? `/api/admin/legal/party-options?type=${partyType}&search=${encodeURIComponent(debouncedKeyword)}`
      : null,
  );
  const options = data?.options ?? [];

  return (
    <div className="relative">
      <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
      <input
        type="search"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        className={SEARCH_INPUT_CLASS}
        placeholder={`Cari ${typeLabel.toLowerCase()} (min. ${MIN_SEARCH_LENGTH} huruf)`}
        aria-label={`Cari ${typeLabel}`}
      />
      {isSearchable && keyword.trim() && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {isLoading && <li className="px-3 py-2 text-sm text-gray-500">Mencari...</li>}
          {!isLoading && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">Tidak ada {typeLabel.toLowerCase()} yang cocok</li>
          )}
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(option);
                  setKeyword("");
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">{option.name}</p>
                {option.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{option.description}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
