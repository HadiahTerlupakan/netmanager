import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import type { DepartmentStat, SiteStat } from "./types";

interface PerformanceTableProps {
  readonly departmentAttendance: DepartmentStat[];
  readonly departmentOvertime: DepartmentStat[];
  readonly siteAttendance: SiteStat[];
  readonly siteOvertime: SiteStat[];
  readonly loading: boolean;
}

const getOvertimeHours = <
  T extends { readonly name: string; readonly duration?: number },
>(
  overtimeStats: readonly T[],
  name: string,
): string => {
  const overtime = overtimeStats.find((item) => item.name === name);
  return overtime?.duration ? (overtime.duration / 60).toFixed(1) : "0.0";
};

/** Renders department and site performance breakdown tables. */
export function PerformanceTable({
  departmentAttendance,
  departmentOvertime,
  siteAttendance,
  siteOvertime,
  loading,
}: PerformanceTableProps) {
  const departmentColumns: Column<DepartmentStat>[] = [
    {
      key: "name",
      header: "Departemen",
      priority: "primary",
      render: (item) => (
        <span className="font-medium text-sm">{item.name}</span>
      ),
    },
    {
      key: "present",
      header: "Hadir",
      priority: "primary",
      align: "center",
      render: (item) => (
        <span className="font-bold text-blue-600">{item.present}</span>
      ),
    },
    {
      key: "late",
      header: "Late",
      priority: "secondary",
      align: "center",
      render: (item) => <span className="text-yellow-600">{item.late}</span>,
    },
    {
      key: "overtime",
      header: "OT (jam)",
      priority: "secondary",
      align: "center",
      render: (item) => (
        <span className="text-purple-600 font-medium">
          {getOvertimeHours(departmentOvertime, item.name)}
        </span>
      ),
    },
  ];

  const siteColumns: Column<SiteStat>[] = [
    {
      key: "name",
      header: "Site",
      priority: "primary",
      render: (item) => (
        <span className="font-medium text-sm">{item.name}</span>
      ),
    },
    {
      key: "present",
      header: "Hadir",
      priority: "primary",
      align: "center",
      render: (item) => (
        <span className="font-bold text-blue-600">{item.present}</span>
      ),
    },
    {
      key: "late",
      header: "Late",
      priority: "secondary",
      align: "center",
      render: (item) => <span className="text-yellow-600">{item.late}</span>,
    },
    {
      key: "overtime",
      header: "OT (jam)",
      priority: "secondary",
      align: "center",
      render: (item) => (
        <span className="text-purple-600 font-medium">
          {getOvertimeHours(siteOvertime, item.name)}
        </span>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
          Performa per Departemen
        </h3>
        <ResponsiveTable<DepartmentStat>
          data={departmentAttendance}
          loading={loading}
          keyField="name"
          columns={departmentColumns}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
          Performa per Site
        </h3>
        <ResponsiveTable<SiteStat>
          data={siteAttendance}
          loading={loading}
          keyField="name"
          columns={siteColumns}
        />
      </div>
    </div>
  );
}
