"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { useApi } from "@/lib/hooks/useApi";
import {
  fetchWithHandling,
  formatErrorMessage,
  isFetchError,
} from "@/lib/utils/fetch-wrapper";
import { validateDateRange } from "@/lib/utils/validation";
import { AttendanceSummaryCards } from "./AttendanceSummaryCards";
import { AttendanceTrendChart } from "./AttendanceTrendChart";
import { EmployeeRecapTable, type SortConfig } from "./EmployeeRecapTable";
import { OvertimeTrendChart } from "./OvertimeTrendChart";
import { PerformanceTable } from "./PerformanceTable";
import { RateLimitWarning } from "./RateLimitWarning";
import { ReportFilters } from "./ReportFilters";
import { ReportTabNavigation, type ReportTab } from "./ReportTabNavigation";
import type { EmployeeSummary, ReportData, ReportOption } from "./types";
import { useReportChartRegistration } from "./useReportChartRegistration";

const getFirstDayOfCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

const getToday = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}j ${remainingMinutes}m`;
};

/** Orchestrates attendance report filters, data loading, charts, and recap views. */
export function ClientComponent() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(getFirstDayOfCurrentMonth);
  const [endDate, setEndDate] = useState(getToday);
  const [siteId, setSiteId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [activeTab, setActiveTab] = useState<ReportTab>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "hadir",
    direction: "desc",
  });
  const reportControllerRef = useRef<AbortController | null>(null);

  const debouncedStartDate = useDebounce(startDate, 300);
  const debouncedEndDate = useDebounce(endDate, 300);
  const debouncedSiteId = useDebounce(siteId, 300);
  const debouncedDepartmentId = useDebounce(departmentId, 300);

  const { data: optionsData, mutate: mutateOptions } = useApi<{
    sites?: ReportOption[];
    departments?: ReportOption[];
  }>("/api/admin/options?resource=attendance");
  const sites = optionsData?.sites ?? [];
  const departments = optionsData?.departments ?? [];

  useReportChartRegistration();

  useEffect(() => {
    if (retryCountdown !== null && retryCountdown > 0) {
      const timer = setTimeout(
        () =>
          setRetryCountdown(retryCountdown === 1 ? null : retryCountdown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [retryCountdown]);

  const fetchOptionsCallback = useCallback(async () => {
    await mutateOptions();
  }, [mutateOptions]);

  useEffect(() => {
    void fetchOptionsCallback();
  }, [fetchOptionsCallback]);

  const fetchReport = useCallback(
    async (signal?: AbortSignal) => {
      if (retryCountdown !== null) return;

      const validation = validateDateRange(
        debouncedStartDate,
        debouncedEndDate,
      );
      if (!validation.valid) {
        showToast("error", validation.error || "Filter tidak valid");
        return;
      }

      setLoading(true);
      try {
        const params: Record<string, string> = {
          startDate: debouncedStartDate,
          endDate: debouncedEndDate || "",
        };
        if (debouncedSiteId) params.siteId = debouncedSiteId;
        if (debouncedDepartmentId) params.departmentId = debouncedDepartmentId;

        const query = new URLSearchParams(params);
        const response = await fetchWithHandling<ReportData>(
          `/api/admin/reports/presence?${query.toString()}`,
          { signal },
        );
        setData(response.data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (isFetchError(error)) {
          if (error.retryAfter) {
            setRetryCountdown(error.retryAfter);
          }
          showToast("error", formatErrorMessage(error));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [
      debouncedStartDate,
      debouncedEndDate,
      debouncedSiteId,
      debouncedDepartmentId,
      retryCountdown,
      showToast,
    ],
  );

  const reportKey = `${debouncedStartDate}|${debouncedEndDate}|${debouncedSiteId}|${debouncedDepartmentId}|${retryCountdown}`;

  useEffect(() => {
    reportControllerRef.current?.abort();
    const controller = new AbortController();
    reportControllerRef.current = controller;
    const timer = setTimeout(() => void fetchReport(controller.signal), 0);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [reportKey, fetchReport]);

  const handleExportCSV = () => {
    if (!data?.attendance?.employeeSummary) return;

    const headers = [
      "Nama",
      "Site",
      "Departemen",
      "Hadir",
      "Terlambat",
      "Izin",
      "Alpha",
      "Lembur (Jam)",
      "Total Jam Kerja",
    ];
    const rows = data.attendance.employeeSummary.map(
      (employee: EmployeeSummary) => [
        `"${employee.user?.name || "-"}"`,
        `"${employee.user?.site?.name || "-"}"`,
        `"${employee.user?.department?.name || "-"}"`,
        employee.hadir,
        employee.terlambat,
        employee.izin,
        employee.alpha,
        employee.lemburJam,
        employee.totalJamKerja,
      ],
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) => row.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `rekap-karyawan-${startDate}-ke-${endDate}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
        Laporan Kinerja Kehadiran & Lembur
      </h1>

      {retryCountdown !== null && (
        <RateLimitWarning retryCountdown={retryCountdown} />
      )}

      <ReportFilters
        startDate={startDate}
        endDate={endDate}
        siteId={siteId}
        departmentId={departmentId}
        sites={sites}
        departments={departments}
        loading={loading}
        retryCountdown={retryCountdown}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onSiteIdChange={setSiteId}
        onDepartmentIdChange={setDepartmentId}
        onApply={() => fetchReport()}
      />

      <ReportTabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {loading && !data && (
        <div className="p-12 text-center text-gray-500 dark:text-gray-400 italic">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
          <p>Menganalisis data laporan...</p>
        </div>
      )}

      {data && activeTab === "dashboard" && (
        <>
          <AttendanceSummaryCards
            attendance={data.attendance.summary}
            overtime={data.overtime.summary}
            formatDuration={formatDuration}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AttendanceTrendChart trends={data.attendance.trends} />
            <OvertimeTrendChart trends={data.overtime.trends} />
          </div>

          <PerformanceTable
            departmentAttendance={data.attendance.byDepartment}
            departmentOvertime={data.overtime.byDepartment}
            siteAttendance={data.attendance.bySite}
            siteOvertime={data.overtime.bySite}
            loading={loading}
          />
        </>
      )}

      {data && activeTab === "rekap" && (
        <EmployeeRecapTable
          employees={data.attendance.employeeSummary}
          loading={loading}
          searchQuery={searchQuery}
          sortConfig={sortConfig}
          onSearchQueryChange={setSearchQuery}
          onSortChange={setSortConfig}
          onExportCSV={handleExportCSV}
        />
      )}
    </div>
  );
}
