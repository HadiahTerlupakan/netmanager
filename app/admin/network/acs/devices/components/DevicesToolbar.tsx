import { Filter, RefreshCw, Search } from "lucide-react";

import type { StatusFilter } from "@/app/admin/network/acs/devices/DevicesClient";

type DevicesToolbarProps = {
  searchTerm: string;
  loading: boolean;
  statusFilter: StatusFilter;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onRefresh: () => void;
};

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "critical", label: "Critical RX" },
];

export function DevicesToolbar({
  searchTerm,
  loading,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onRefresh,
}: DevicesToolbarProps) {
  return (
    <div className="flex items-center space-x-3">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
        <input
          type="text"
          placeholder="Cari Serial / PPPoE / IP..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[13px] w-64 placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Filter className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          className="pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[13px] appearance-none cursor-pointer"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="px-4 py-2 bg-[#3b5fe5] text-white rounded-md text-[13px] font-medium hover:bg-blue-700 flex items-center shadow-sm disabled:opacity-50"
      >
        <RefreshCw
          className={"w-4 h-4 mr-1.5 " + (loading ? "animate-spin" : "")}
        />{" "}
        Refresh
      </button>
    </div>
  );
}
