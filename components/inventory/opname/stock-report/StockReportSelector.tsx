"use client";

import { FiRefreshCw } from "react-icons/fi";

import { Button } from "@/components/ui/Button";

import type { GudangOption } from "./useStockReport";

type StockReportSelectorProps = {
  gudangOptions: GudangOption[];
  selectedGudangId: string;
  loading: boolean;
  onSelect: (gudangId: string) => void;
  onRefresh: () => void;
};

export function StockReportSelector({
  gudangOptions,
  selectedGudangId,
  loading,
  onSelect,
  onRefresh,
}: StockReportSelectorProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Laporan Stok Gudang
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pilih gudang untuk melihat laporan stok
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <select
            value={selectedGudangId}
            onChange={(event) => onSelect(event.target.value)}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-w-0"
          >
            <option value="">-- Pilih Gudang --</option>
            {gudangOptions.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
          <Button
            onClick={onRefresh}
            disabled={!selectedGudangId || loading}
            className="shrink-0 inline-flex items-center p-2 sm:px-3 sm:py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            <FiRefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""} sm:mr-2`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
