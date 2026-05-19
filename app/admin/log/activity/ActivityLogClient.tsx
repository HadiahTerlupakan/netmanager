"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineRefresh,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineSearch,
} from "react-icons/hi";
import { HiOutlineUser, HiOutlineTag } from "react-icons/hi2";
import { format } from "date-fns";
import { id } from "date-fns/locale";

import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import { SiteFilter } from "@/components/common/SiteFilter";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { useDebounce } from "@/hooks/useDebounce";
import { useApi } from "@/lib/hooks/useApi";
import { clientLogger } from "@/lib/client-logger";

interface SystemLog {
  id: string;
  action: string;
  subject: string;
  details: Record<string, unknown> | string | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  } | null;
}

interface ActivityLogResponse {
  logs: SystemLog[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    total: number;
  };
}

interface FilterState {
  siteId: string | undefined;
  search: string;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_MAX_LENGTH = 200;
const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|api[-_]?key|authorization|credential|otp|pin/i;
const REDACTED_VALUE = "***";

const DEFAULT_PAGINATION: ActivityLogResponse["pagination"] = {
  page: 1,
  limit: PAGE_SIZE,
  totalPages: 1,
  total: 0,
};

const ACTION_BADGE_CLASS: Record<string, string> = {
  CREATE:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const FALLBACK_BADGE_CLASS =
  "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";

export function ActivityLogClient() {
  const [filters, setFilters] = useState<FilterState>({
    siteId: undefined,
    search: "",
  });
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

  const debouncedSearch = useDebounce(filters.search, SEARCH_DEBOUNCE_MS);

  const apiUrl = useMemo(
    () =>
      buildApiUrl({
        page,
        siteId: filters.siteId,
        search: debouncedSearch,
      }),
    [page, filters.siteId, debouncedSearch],
  );

  const {
    data: response,
    error,
    isLoading: loading,
    mutate,
  } = useApi<ActivityLogResponse>(apiUrl);

  useEffect(() => {
    if (error) {
      clientLogger.error("Gagal memuat log aktivitas", error);
    }
  }, [error]);

  const logs = response?.logs ?? [];
  const pagination = response?.pagination ?? DEFAULT_PAGINATION;

  /** Setter wrapper agar setiap perubahan filter reset page ke 1. */
  const patchFilters = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

  const columns = useMemo<Column<SystemLog>[]>(
    () => buildColumns(setSelectedLog),
    [],
  );

  const formattedDetail = useMemo(
    () => (selectedLog ? formatDetails(selectedLog.details) : ""),
    [selectedLog],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Log Aktivitas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Riwayat aktivitas perubahan data dalam sistem
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari aktivitas..."
              maxLength={SEARCH_MAX_LENGTH}
              value={filters.search}
              onChange={(e) => patchFilters({ search: e.target.value })}
              className="pl-10 pr-4 py-2 w-full md:w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <HiOutlineSearch className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          </div>
          <div className="w-full md:w-48">
            <SiteFilter
              onSiteChange={(siteId) => patchFilters({ siteId })}
              resource="system_log"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => mutate()}
            className="inline-flex items-center gap-2"
          >
            <HiOutlineRefresh
              className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading && logs.length === 0 ? (
          <PageLoader variant="section" message="Memuat log aktivitas..." />
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Belum ada data log aktivitas.</p>
          </div>
        ) : (
          <>
            <ResponsiveTable
              data={logs}
              loading={loading}
              keyField="id"
              columns={columns}
              emptyMessage="Belum ada data log aktivitas."
            />

            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Hal {pagination.page} dari {pagination.totalPages} (
                  {pagination.total} Log)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Detail Log Aktivitas"
        size="2xl"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <DetailRow
                label="Waktu"
                value={format(
                  new Date(selectedLog.createdAt),
                  "dd MMMM yyyy HH:mm:ss",
                  { locale: id },
                )}
              />
              <DetailRow label="Aksi" value={selectedLog.action} />
              <DetailRow label="Subjek" value={selectedLog.subject} />
              <DetailRow
                label="Pengguna"
                value={
                  selectedLog.user?.name || selectedLog.user?.email || "System"
                }
              />
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase mb-2">
                Detail Data
              </p>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap">
                  {formattedDetail}
                </pre>
              </div>
            </div>
          </div>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => setSelectedLog(null)}>
            Tutup
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function buildApiUrl(input: {
  page: number;
  siteId?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  params.append("type", "ACTIVITY");
  params.append("page", input.page.toString());
  params.append("limit", PAGE_SIZE.toString());
  if (input.siteId) params.append("siteId", input.siteId);
  if (input.search) params.append("search", input.search);
  return `/api/admin/system-logs?${params.toString()}`;
}

function buildColumns(onSelect: (log: SystemLog) => void): Column<SystemLog>[] {
  return [
    {
      key: "createdAt",
      header: "Waktu",
      priority: "primary",
      render: (item) => (
        <div className="flex items-center gap-2">
          <HiOutlineClock className="w-4 h-4 text-gray-400" />
          {format(new Date(item.createdAt), "dd MMM yyyy HH:mm", {
            locale: id,
          })}
        </div>
      ),
    },
    {
      key: "user",
      header: "Pengguna",
      priority: "primary",
      render: (item) => (
        <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
          <HiOutlineUser className="w-4 h-4 text-gray-400" />
          {item.user?.name || item.user?.email || "System"}
        </div>
      ),
    },
    {
      key: "subject",
      header: "Subjek",
      priority: "secondary",
      render: (item) => (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <HiOutlineTag className="w-4 h-4 text-gray-400" />
          {item.subject}
        </div>
      ),
    },
    {
      key: "action",
      header: "Aksi",
      priority: "primary",
      render: (item) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_BADGE_CLASS[item.action] ?? FALLBACK_BADGE_CLASS}`}
        >
          {item.action}
        </span>
      ),
    },
    {
      key: "detail",
      header: "Detail",
      priority: "secondary",
      render: (item) => (
        <Button
          variant="link"
          onClick={() => onSelect(item)}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 hover:underline text-sm p-0 h-auto"
        >
          Lihat Detail
        </Button>
      ),
    },
  ];
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

/**
 * Format JSON details untuk modal: parse string → JSON, redact field
 * sensitif (password/token/secret/dst.). Fallback ke representasi raw
 * bila parse gagal.
 */
function formatDetails(details: SystemLog["details"]): string {
  if (details == null) return "Tidak ada detail tambahan";

  try {
    const parsed = typeof details === "string" ? JSON.parse(details) : details;
    return JSON.stringify(redactSensitive(parsed), null, 2);
  } catch {
    if (typeof details === "string") return details;
    return JSON.stringify(redactSensitive(details), null, 2);
  }
}

function redactSensitive(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = REDACTED_VALUE;
    } else {
      result[key] = redactSensitive(val);
    }
  }
  return result;
}
