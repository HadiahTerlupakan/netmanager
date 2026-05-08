import { FaSearch } from "react-icons/fa";
import { Button } from "@/components/ui/Button";

interface OptionItem {
  id: string;
  name: string;
}

interface OvertimeFiltersProps {
  startDate: string;
  endDate: string;
  siteId: string;
  departmentId: string;
  statusFilter: string;
  holidayFilter: string;
  sites: OptionItem[];
  departments: OptionItem[];
  retryCountdown: number | null;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSiteIdChange: (value: string) => void;
  onDepartmentIdChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onHolidayFilterChange: (value: string) => void;
  onSearch: () => void;
}

export function OvertimeFilters({
  startDate,
  endDate,
  siteId,
  departmentId,
  statusFilter,
  holidayFilter,
  sites,
  departments,
  retryCountdown,
  onStartDateChange,
  onEndDateChange,
  onSiteIdChange,
  onDepartmentIdChange,
  onStatusFilterChange,
  onHolidayFilterChange,
  onSearch,
}: OvertimeFiltersProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow dark:bg-gray-800 flex flex-wrap gap-4 items-end">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
          Dari Tanggal
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
          Sampai Tanggal
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
          Site
        </label>
        <select
          value={siteId}
          onChange={(e) => onSiteIdChange(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-40 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
          Departemen
        </label>
        <select
          value={departmentId}
          onChange={(e) => onDepartmentIdChange(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-40 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Semua Dept</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
          Status
        </label>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-40 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Semua Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
          Tipe Hari
        </label>
        <select
          value={holidayFilter}
          onChange={(e) => onHolidayFilterChange(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-44 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Semua Hari</option>
          <option value="REGULAR">Hari Kerja</option>
          <option value="ALL_HOLIDAY">Semua Libur</option>
          <option value="NATIONAL">🎌 Libur Nasional</option>
          <option value="COLLECTIVE">🏖️ Cuti Bersama</option>
          <option value="OFFDAY">📅 Hari Libur Karyawan</option>
        </select>
      </div>
      <Button
        onClick={onSearch}
        disabled={retryCountdown !== null}
        variant="default"
        className="px-4 py-2 rounded-lg text-sm h-[38px] flex items-center gap-2 disabled:opacity-50 transition-all font-medium shadow-sm hover:shadow-md active:scale-95"
      >
        <FaSearch className="w-3.5 h-3.5" /> Cari
      </Button>
    </div>
  );
}
