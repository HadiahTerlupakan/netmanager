"use client";

import {
  HiMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlinePlus,
} from "react-icons/hi2";

interface MitraPageHeaderProps {
  readonly canCreate: boolean;
  readonly onAdd: () => void;
}

export function MitraPageHeader({ canCreate, onAdd }: MitraPageHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Manajemen Mitra
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Kelola mitra teknisi dan mitra sales
        </p>
      </div>
      {canCreate && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
        >
          <HiOutlinePlus className="w-5 h-5 text-white" />
          <span className="text-white">Tambah Mitra</span>
        </button>
      )}
    </div>
  );
}

interface MitraFiltersProps {
  readonly searchTerm: string;
  readonly onSearchTermChange: (value: string) => void;
  readonly typeFilter: "all" | "MITRA_TEKNISI" | "MITRA_SALES";
  readonly onTypeFilterChange: (
    value: "all" | "MITRA_TEKNISI" | "MITRA_SALES",
  ) => void;
}

export function MitraFilters({
  searchTerm,
  onSearchTermChange,
  typeFilter,
  onTypeFilterChange,
}: MitraFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <HiMagnifyingGlass className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari mitra berdasarkan nama, email, atau telepon..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <HiOutlineFunnel className="h-5 w-5 text-gray-400" />
          </div>
          <select
            value={typeFilter}
            onChange={(event) =>
              onTypeFilterChange(
                event.target.value as "all" | "MITRA_TEKNISI" | "MITRA_SALES",
              )
            }
            className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">Semua Tipe</option>
            <option value="MITRA_TEKNISI">Mitra Teknisi</option>
            <option value="MITRA_SALES">Mitra Sales</option>
          </select>
        </div>
      </div>
    </div>
  );
}
