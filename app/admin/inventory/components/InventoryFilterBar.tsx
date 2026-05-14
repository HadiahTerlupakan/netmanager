"use client";

import { FiSearch, FiCalendar, FiFilter } from "react-icons/fi";
import type {
  InventoryFilters,
  Site,
  Gudang,
} from "../hooks/useInventoryFilters";

type ColorVariant = "green" | "orange";

interface InventoryFilterBarProps {
  filters: InventoryFilters;
  onFilterChange: <K extends keyof InventoryFilters>(
    key: K,
    value: InventoryFilters[K],
  ) => void;
  sites: Site[];
  gudangs: Gudang[];
  colorVariant?: ColorVariant;
}

/** Shared filter bar for inventory masuk/keluar lists */
export function InventoryFilterBar({
  filters,
  onFilterChange,
  sites,
  gudangs,
  colorVariant = "green",
}: InventoryFilterBarProps) {
  const ringColor =
    colorVariant === "green"
      ? "focus:ring-green-500 focus:border-green-500"
      : "focus:ring-orange-500 focus:border-orange-500";

  const inputClassName = `block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 ${ringColor} sm:text-sm`;

  return (
    <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            placeholder="Cari barang, kode, user..."
            className={inputClassName}
          />
        </div>

        {/* Site Filter */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiFilter className="text-gray-400" />
          </div>
          <select
            value={filters.siteId}
            onChange={(e) => onFilterChange("siteId", e.target.value)}
            className={inputClassName}
          >
            <option value="">Semua Site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        {/* Warehouse Filter */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiFilter className="text-gray-400" />
          </div>
          <select
            value={filters.gudangId}
            onChange={(e) => onFilterChange("gudangId", e.target.value)}
            className={inputClassName}
          >
            <option value="">Semua Gudang</option>
            {gudangs.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.nama}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiCalendar className="text-gray-400" />
          </div>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange("startDate", e.target.value)}
            className={inputClassName}
          />
        </div>

        {/* End Date */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiCalendar className="text-gray-400" />
          </div>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange("endDate", e.target.value)}
            className={inputClassName}
          />
        </div>
      </div>
    </div>
  );
}
