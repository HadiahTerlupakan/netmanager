import Image from "next/image";
import { FaFileExport, FaSearch } from "react-icons/fa";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import type { EmployeeSummary } from "./types";

interface EmployeeRecapTableProps {
  readonly employees: EmployeeSummary[];
  readonly loading: boolean;
  readonly searchQuery: string;
  readonly sortConfig: SortConfig;
  readonly onSearchQueryChange: (value: string) => void;
  readonly onSortChange: (sortConfig: SortConfig) => void;
  readonly onExportCSV: () => void;
}

export interface SortConfig {
  readonly key: string;
  readonly direction: "asc" | "desc";
}

const getSortValue = (item: EmployeeSummary, key: string): number => {
  switch (key) {
    case "hadir":
      return item.hadir;
    case "terlambat":
      return item.terlambat;
    case "izin":
      return item.izin;
    case "alpha":
      return item.alpha;
    case "lemburJam":
      return item.lemburJam;
    case "totalJamKerja":
      return item.totalJamKerja;
    default:
      return 0;
  }
};

const rekapColumns: Column<EmployeeSummary>[] = [
  {
    key: "name",
    header: "Karyawan",
    priority: "primary",
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
          <Image
            width={32}
            height={32}
            src={
              item.user?.image ||
              `https://ui-avatars.com/api/?name=${item.user?.name}&background=random`
            }
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
            {item.user?.name}
          </p>
          <p className="text-[10px] text-gray-500 truncate">
            {item.user?.department?.name || "-"}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "site",
    header: "Site",
    priority: "tertiary",
    render: (item) => (
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {item.user?.site?.name || "-"}
      </span>
    ),
  },
  {
    key: "hadir",
    header: "Hadir",
    priority: "primary",
    align: "center",
    sortable: true,
    render: (item) => (
      <span className="font-bold text-blue-600 dark:text-blue-400">
        {item.hadir}
      </span>
    ),
  },
  {
    key: "terlambat",
    header: "Late",
    priority: "secondary",
    align: "center",
    sortable: true,
    render: (item) => (
      <span className="text-yellow-600 font-medium">{item.terlambat}</span>
    ),
  },
  {
    key: "izin",
    header: "Izin",
    priority: "secondary",
    align: "center",
    sortable: true,
    render: (item) => <span className="text-green-600">{item.izin}</span>,
  },
  {
    key: "alpha",
    header: "Alpha",
    priority: "primary",
    align: "center",
    sortable: true,
    render: (item) => (
      <span className="text-red-600 font-bold">{item.alpha}</span>
    ),
  },
  {
    key: "lemburJam",
    header: "OT (j)",
    priority: "secondary",
    align: "center",
    sortable: true,
    render: (item) => <span className="text-purple-600">{item.lemburJam}</span>,
  },
  {
    key: "totalJamKerja",
    header: "Total Jam",
    priority: "primary",
    align: "center",
    sortable: true,
    render: (item) => (
      <span className="font-bold text-teal-600 dark:text-teal-400">
        {item.totalJamKerja}
      </span>
    ),
  },
];

/** Renders searchable and sortable employee attendance recap table. */
export function EmployeeRecapTable({
  employees,
  loading,
  searchQuery,
  sortConfig,
  onSearchQueryChange,
  onSortChange,
  onExportCSV,
}: EmployeeRecapTableProps) {
  const filteredEmployees = employees
    .filter((employee) => {
      if (!searchQuery) return true;
      return employee.user?.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
          Rekap Kehadiran Karyawan
        </h3>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Cari nama..."
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              className="border rounded pl-8 pr-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white w-48"
            />
          </div>
          <Button variant="success" onClick={onExportCSV}>
            <FaFileExport /> Export CSV
          </Button>
        </div>
      </div>

      <ResponsiveTable<EmployeeSummary>
        data={filteredEmployees}
        loading={loading}
        keyField="userId"
        columns={rekapColumns}
        sortColumn={sortConfig.key}
        sortDirection={sortConfig.direction}
        onSort={(key, direction) => onSortChange({ key, direction })}
        emptyMessage="Tidak ada data karyawan sesuai filter"
      />
    </div>
  );
}
