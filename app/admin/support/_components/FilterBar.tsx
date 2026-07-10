"use client";

import type { ReactNode } from "react";

export interface FilterState {
  search: string;
  statusFilter: string;
  categoryFilter: string;
  priorityFilter: string;
}

export const INITIAL_FILTERS: FilterState = {
  search: "",
  statusFilter: "",
  categoryFilter: "",
  priorityFilter: "",
};

export interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}

export function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface FilterBarProps {
  filters: FilterState;
  onPatch: (patch: Partial<FilterState>) => void;
  searchIcon: ReactNode;
}

export function FilterBar({ filters, onPatch, searchIcon }: FilterBarProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            {searchIcon}
            <input
              type="text"
              placeholder="Cari tiket atau pelanggan..."
              value={filters.search}
              onChange={(e) => onPatch({ search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <FilterSelect
          value={filters.statusFilter}
          onChange={(value) => onPatch({ statusFilter: value })}
          placeholder="Semua Status"
          options={[
            { value: "OPEN", label: "Baru" },
            { value: "IN_PROGRESS", label: "Dalam Proses" },
            { value: "WAITING_CUSTOMER", label: "Menunggu Pelanggan" },
            { value: "RESOLVED", label: "Selesai" },
            { value: "CLOSED", label: "Ditutup" },
          ]}
        />

        <FilterSelect
          value={filters.categoryFilter}
          onChange={(value) => onPatch({ categoryFilter: value })}
          placeholder="Semua Kategori"
          options={[
            { value: "TECHNICAL", label: "Teknis" },
            { value: "BILLING", label: "Tagihan" },
            { value: "ACCOUNT", label: "Akun" },
            { value: "OTHER", label: "Lainnya" },
          ]}
        />

        <FilterSelect
          value={filters.priorityFilter}
          onChange={(value) => onPatch({ priorityFilter: value })}
          placeholder="Semua Prioritas"
          options={[
            { value: "URGENT", label: "Urgent" },
            { value: "HIGH", label: "Tinggi" },
            { value: "MEDIUM", label: "Medium" },
            { value: "LOW", label: "Rendah" },
          ]}
        />
      </div>
    </div>
  );
}
