"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { HiOutlineMagnifyingGlass, HiOutlineMapPin, HiOutlinePlus, HiXMark } from "react-icons/hi2";
import { useApi } from "@/lib/hooks/useApi";
import {
  MAX_AREA_NAME_LENGTH,
  addCustomArea,
  hasAffectedArea,
  toggleAffectedArea,
} from "./incident-format";

/**
 * Pemilih area terdampak: site milik tenant dicentang, plus area lain yang
 * diketik (mis. nama desa) bila gangguan tidak tepat satu site. Yang disimpan
 * nama area, karena itu yang ditampilkan di halaman status publik.
 */

interface SiteOption {
  id: string;
  code: string | null;
  name: string;
}

/** Kolom cari baru muncul bila site cukup banyak untuk perlu disaring. */
const SEARCH_THRESHOLD = 8;

export function AffectedAreaPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (areas: string[]) => void;
}) {
  const { data, isLoading } = useApi<{ sites?: SiteOption[] }>("/api/sites");
  const sites = useMemo(() => data?.sites ?? [], [data?.sites]);
  const [keyword, setKeyword] = useState("");
  const [customArea, setCustomArea] = useState("");

  const visibleSites = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((site) =>
      `${site.name} ${site.code ?? ""}`.toLowerCase().includes(needle),
    );
  }, [sites, keyword]);

  const addTypedArea = () => {
    onChange(addCustomArea(value, customArea));
    setCustomArea("");
  };

  const handleCustomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    // Enter menambah area, bukan mengirim form insiden.
    event.preventDefault();
    addTypedArea();
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Area terpilih">
          {value.map((area) => (
            <span
              key={area}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
            >
              {area}
              <button
                type="button"
                onClick={() => onChange(toggleAffectedArea(value, area))}
                className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-800"
                aria-label={`Hapus ${area}`}
              >
                <HiXMark className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        {sites.length > SEARCH_THRESHOLD && (
          <div className="relative border-b border-gray-200 dark:border-gray-700">
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Cari site..."
              aria-label="Cari site"
              className="w-full rounded-t-lg bg-transparent py-2 pl-9 pr-3 text-sm text-gray-900 outline-none dark:text-white"
            />
          </div>
        )}

        <div className="max-h-44 overflow-y-auto p-1">
          {isLoading && <p className="px-3 py-2 text-sm text-gray-500">Memuat site...</p>}
          {!isLoading && sites.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">
              Belum ada site. Ketik nama area di bawah.
            </p>
          )}
          {!isLoading && sites.length > 0 && visibleSites.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">Site tidak ditemukan.</p>
          )}
          {visibleSites.map((site) => (
            <label
              key={site.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <input
                type="checkbox"
                checked={hasAffectedArea(value, site.name)}
                onChange={() => onChange(toggleAffectedArea(value, site.name))}
                className="h-4 w-4"
              />
              <HiOutlineMapPin className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="text-gray-900 dark:text-white">{site.name}</span>
              {site.code && <span className="text-xs text-gray-500">{site.code}</span>}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={customArea}
          onChange={(event) => setCustomArea(event.target.value)}
          onKeyDown={handleCustomKeyDown}
          maxLength={MAX_AREA_NAME_LENGTH}
          placeholder="Area lain, mis. Desa Sukamaju"
          aria-label="Area lain"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={addTypedArea}
          disabled={!customArea.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <HiOutlinePlus className="h-4 w-4" />
          Tambah
        </button>
      </div>
    </div>
  );
}
