"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  HiOutlinePlus,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
} from "react-icons/hi2";
import { useApi } from "@/lib/hooks/useApi";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import {
  PLANNING_STATUS_CONFIG,
  formatBudget,
  formatDateShort,
} from "@/modules/planning";
import type { PlanningListItemDTO } from "@/modules/planning";
import type { PlanningStatus } from "@/modules/planning";

type PaginatedResponse = {
  data: PlanningListItemDTO[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Semua Status" },
  { value: "BACKLOG", label: "Backlog" },
  { value: "PENDING_APPROVAL", label: "Menunggu Approval" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "IN_PROGRESS", label: "Berjalan" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

export default function PlanningListClient() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("planning:create");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Debounced search (300ms)
  const debouncedSearch = useDebounced(searchInput, 300);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    return `/api/planning?${params.toString()}`;
  }, [page, debouncedSearch, statusFilter]);

  const { data: response, isLoading } = useApi<PaginatedResponse>(url, {
    onError: () => toast.error("Gagal memuat data planning"),
  });

  const plannings = response?.data ?? [];
  const meta = response?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? 0;

  const columns: Column<PlanningListItemDTO>[] = [
    {
      key: "title",
      header: "Judul",
      priority: "primary",
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {item.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {item.area}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (item) => {
        const config = PLANNING_STATUS_CONFIG[item.status as PlanningStatus];
        return (
          <span
            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${config.className}`}
          >
            {config.label}
          </span>
        );
      },
    },
    {
      key: "estimatedUnits",
      header: "Unit",
      priority: "secondary",
      render: (item) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {item.estimatedUnits} unit
        </span>
      ),
    },
    {
      key: "estimatedBudget",
      header: "Estimasi Budget",
      priority: "secondary",
      render: (item) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {formatBudget(item.estimatedBudget)}
        </span>
      ),
    },
    {
      key: "progressPercentage",
      header: "Progress",
      priority: "secondary",
      render: (item) => (
        <div className="flex items-center gap-2 w-28">
          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${item.progressPercentage}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {item.progressPercentage}%
          </span>
        </div>
      ),
    },
    {
      key: "targetCompletionDate",
      header: "Target",
      priority: "tertiary",
      render: (item) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {formatDateShort(item.targetCompletionDate)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Daftar Planning OSP
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total > 0
              ? `${total} planning terdaftar`
              : "Kelola perencanaan ekspansi jaringan"}
          </p>
        </div>
        {canCreate && (
          <Link href="/admin/planning/baru">
            <Button>
              <HiOutlinePlus className="w-4 h-4" />
              Buat Planning
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan judul, area, atau deskripsi..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <HiOutlineFunnel className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-8 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none cursor-pointer"
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : plannings.length === 0 ? (
          <EmptyState
            icon={<HiOutlinePlus className="w-12 h-12" />}
            title={
              debouncedSearch || statusFilter
                ? "Tidak ada hasil"
                : "Belum ada planning"
            }
            description={
              debouncedSearch || statusFilter
                ? "Coba ubah filter pencarian Anda."
                : "Buat planning OSP pertama untuk mulai melacak ekspansi jaringan."
            }
            action={
              !debouncedSearch && !statusFilter && canCreate ? (
                <Link href="/admin/planning/baru">
                  <Button>
                    <HiOutlinePlus className="w-4 h-4" />
                    Buat Planning
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ResponsiveTable
            data={plannings}
            columns={columns}
            keyField="id"
            loading={isLoading}
            onRowClick={(item) => router.push(`/admin/planning/${item.id}`)}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            emptyMessage="Tidak ada planning"
          />
        )}
      </div>
    </div>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
