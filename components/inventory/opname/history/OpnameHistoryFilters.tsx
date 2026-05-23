"use client";

import { useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";

import type { OpnameHistoryFilters } from "./useOpnameHistory";

const ALASAN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Semua Alasan" },
  { value: "hilang", label: "Hilang" },
  { value: "rusak", label: "Rusak" },
  { value: "revisi", label: "Revisi" },
  { value: "salah_input", label: "Salah Input" },
  { value: "terpakai", label: "Terpakai" },
  { value: "expired", label: "Expired" },
  { value: "lebih", label: "Stok Lebih" },
  { value: "lainnya", label: "Lainnya" },
];

type GudangOption = { id: string; kode: string; nama: string };

type GudangResponse = {
  gudangs?: GudangOption[];
  data?: { gudangs?: GudangOption[] };
};

async function fetchGudangOptions(
  signal: AbortSignal,
): Promise<GudangOption[]> {
  const response = await fetch("/api/inventory/gudang?view=all", { signal });
  if (!response.ok) throw new Error("Gagal memuat daftar gudang");
  const json: GudangResponse = await response.json();
  return json.gudangs ?? json.data?.gudangs ?? [];
}

type OpnameHistoryFiltersProps = {
  filters: OpnameHistoryFilters;
  onFilterChange: (next: Partial<OpnameHistoryFilters>) => void;
  onFilterReset: () => void;
};

export function OpnameHistoryFiltersBar({
  filters,
  onFilterChange,
  onFilterReset,
}: OpnameHistoryFiltersProps) {
  const [gudangOptions, setGudangOptions] = useState<GudangOption[]>([]);
  const [loadingGudang, setLoadingGudang] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setLoadingGudang(true);
      try {
        const options = await fetchGudangOptions(controller.signal);
        if (!cancelled) setGudangOptions(options);
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        clientLogger.error("Error loading gudang options:", err);
      } finally {
        if (!cancelled) setLoadingGudang(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Gudang
          </label>
          <select
            value={filters.gudangId}
            onChange={(event) =>
              onFilterChange({ gudangId: event.target.value })
            }
            disabled={loadingGudang}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">Semua Gudang</option>
            {gudangOptions.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} — {gudang.nama}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Tanggal Mulai
          </label>
          <input
            type="date"
            value={filters.tanggalMulai}
            onChange={(event) =>
              onFilterChange({ tanggalMulai: event.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Tanggal Selesai
          </label>
          <input
            type="date"
            value={filters.tanggalSelesai}
            onChange={(event) =>
              onFilterChange({ tanggalSelesai: event.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Alasan Selisih
          </label>
          <select
            value={filters.alasanSelisih}
            onChange={(event) =>
              onFilterChange({ alasanSelisih: event.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ALASAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={onFilterReset} className="w-full">
            <FiRefreshCw className="mr-2 h-4 w-4" />
            Reset Filter
          </Button>
        </div>
      </div>
    </div>
  );
}
