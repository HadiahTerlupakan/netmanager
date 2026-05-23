"use client";

import { useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiMinusCircle,
  FiSearch,
  FiXCircle,
} from "react-icons/fi";

import type { GudangStock, StockItem } from "./useStockReport";

type StockReportTableProps = {
  gudangData: GudangStock;
};

const ROW_BADGE_CLASSES = {
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  yellow:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  purple:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

function filterItems(items: StockItem[], query: string): StockItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter(
    (item) =>
      item.barangKode.toLowerCase().includes(trimmed) ||
      item.barangNama.toLowerCase().includes(trimmed),
  );
}

export function StockReportTable({ gudangData }: StockReportTableProps) {
  const [search, setSearch] = useState("");
  const filteredItems = useMemo(
    () => filterItems(gudangData.items, search),
    [gudangData.items, search],
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Daftar Barang di {gudangData.gudangNama}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredItems.length} dari {gudangData.items.length} jenis barang
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode / nama barang..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Kode
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nama Barang
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Stok Total
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-green-600 uppercase">
                <span className="flex items-center justify-center">
                  <FiCheckCircle className="mr-1" /> Baru
                </span>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-yellow-600 uppercase">
                <span className="flex items-center justify-center">
                  <FiAlertTriangle className="mr-1" /> Bekas
                </span>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-red-600 uppercase">
                <span className="flex items-center justify-center">
                  <FiXCircle className="mr-1" /> Rusak
                </span>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-purple-600 uppercase">
                <span className="flex items-center justify-center">
                  <FiMinusCircle className="mr-1" /> Hilang
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {gudangData.items.length === 0
                    ? "Tidak ada barang di gudang ini"
                    : "Tidak ada barang yang cocok dengan pencarian"}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.barangId}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {item.barangKode}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.barangNama}
                    <span className="ml-2 text-xs text-gray-400">
                      ({item.barangSatuan})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-gray-900 dark:text-white text-lg">
                      {item.stokTotal}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={ROW_BADGE_CLASSES.green}>
                      {item.stokBaru}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={ROW_BADGE_CLASSES.yellow}>
                      {item.stokBekas}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={ROW_BADGE_CLASSES.red}>
                      {item.stokRusak}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.totalHilang > 0 ? (
                      <Badge className={ROW_BADGE_CLASSES.purple}>
                        {item.totalHilang}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {gudangData.items.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              Total Gudang
            </span>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-bold text-gray-900 dark:text-white">
                Stok: {gudangData.totalStok}
              </span>
              <span className="text-green-600 font-medium">
                Baru: {gudangData.totalStokBaru}
              </span>
              <span className="text-yellow-600 font-medium">
                Bekas: {gudangData.totalStokBekas}
              </span>
              <span className="text-red-600 font-medium">
                Rusak: {gudangData.totalStokRusak}
              </span>
              <span className="text-purple-600 font-medium flex items-center">
                <FiMinusCircle className="mr-1" /> Hilang:{" "}
                {gudangData.totalHilang}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${className}`}
    >
      {children}
    </span>
  );
}
