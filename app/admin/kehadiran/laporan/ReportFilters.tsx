import { FaSearch } from "react-icons/fa";
import { Button } from "@/components/ui/Button";
import type { ReportOption } from "./types";

interface ReportFiltersProps {
  readonly startDate: string;
  readonly endDate: string;
  readonly siteId: string;
  readonly departmentId: string;
  readonly sites: readonly ReportOption[];
  readonly departments: readonly ReportOption[];
  readonly loading: boolean;
  readonly retryCountdown: number | null;
  readonly onStartDateChange: (value: string) => void;
  readonly onEndDateChange: (value: string) => void;
  readonly onSiteIdChange: (value: string) => void;
  readonly onDepartmentIdChange: (value: string) => void;
  readonly onApply: () => void;
}

/** Renders report filter controls for date, site, and department. */
export function ReportFilters({
  startDate,
  endDate,
  siteId,
  departmentId,
  sites,
  departments,
  loading,
  retryCountdown,
  onStartDateChange,
  onEndDateChange,
  onSiteIdChange,
  onDepartmentIdChange,
  onApply,
}: ReportFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Dari Tanggal
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Sampai Tanggal
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
          className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Site
        </label>
        <select
          value={siteId}
          onChange={(event) => onSiteIdChange(event.target.value)}
          className="border rounded px-3 py-2 text-sm w-32 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Semua Site</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Departemen
        </label>
        <select
          value={departmentId}
          onChange={(event) => onDepartmentIdChange(event.target.value)}
          className="border rounded px-3 py-2 text-sm w-32 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Semua Dept</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>
      <Button onClick={onApply} disabled={loading || retryCountdown !== null}>
        <FaSearch /> {loading ? "Memuat..." : "Terapkan"}
      </Button>
    </div>
  );
}
