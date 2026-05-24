"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  HiOutlinePlus,
  HiOutlineMagnifyingGlass,
  HiOutlineShieldCheck,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
} from "react-icons/hi2";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { buttonVariants } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";

interface SlaItem {
  id: string;
  name: string;
  description: string | null;
  workOrderType: string | null;
  priority: string | null;
  responseTime: number;
  resolutionTime: number;
  businessHoursOnly: boolean;
  isActive: boolean;
  departments: { id: string; name: string } | null;
  escalations?: { id: string; name: string; escalationLevel: number }[];
  createdAt: string;
}

interface PaginatedSlas {
  data: SlaItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
  NORMAL: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  HIGH: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  URGENT: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  CRITICAL: "bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200",
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) {
    return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
}

export function ClientComponent() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("wo_sla:create");
  const canUpdate = hasPermission("wo_sla:update");
  const canDelete = hasPermission("wo_sla:delete");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">(
    "all",
  );

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const queryUrl = (() => {
    const params = new URLSearchParams();
    params.append("limit", "50");
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (activeFilter !== "all") params.append("isActive", activeFilter);
    return `/api/admin/workorders/slas?${params.toString()}`;
  })();

  const {
    data,
    isLoading,
    error: fetchError,
    mutate,
  } = useApi<PaginatedSlas>(queryUrl);

  const slas = data?.data ?? [];
  const error = fetchError ? fetchError.message || "Gagal memuat data" : null;

  useEffect(() => {
    if (fetchError) {
      clientLogger.error("Failed to fetch SLAs", fetchError);
    }
  }, [fetchError]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus aturan SLA "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/workorders/slas/${id}`, {
        method: "DELETE",
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || "Gagal menghapus aturan SLA");
      }

      toast.success("Aturan SLA berhasil dihapus");
      await mutate();
    } catch (deleteError: unknown) {
      clientLogger.error("Error deleting SLA", deleteError);
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus aturan SLA",
      );
    }
  };

  const columns: Column<SlaItem>[] = [
    {
      key: "name",
      header: "Nama SLA",
      priority: "primary",
      render: (sla) => (
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <HiOutlineShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {sla.name}
            </div>
            {sla.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                {sla.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "workOrderType",
      header: "Tipe / Prioritas",
      priority: "secondary",
      render: (sla) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {sla.workOrderType ?? "Semua tipe"}
          </span>
          {sla.priority ? (
            <span
              className={`inline-flex w-fit px-2 py-0.5 text-xs font-medium rounded ${
                PRIORITY_COLORS[sla.priority] ?? "bg-gray-100"
              }`}
            >
              {sla.priority}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Semua prioritas</span>
          )}
        </div>
      ),
    },
    {
      key: "departments",
      header: "Department",
      priority: "tertiary",
      render: (sla) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {sla.departments?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "responseTime",
      header: "Response",
      priority: "secondary",
      align: "right",
      render: (sla) => (
        <div className="flex items-center justify-end gap-1 text-sm text-gray-700 dark:text-gray-300">
          <HiOutlineClock className="w-4 h-4 text-gray-400" />
          {formatMinutes(sla.responseTime)}
        </div>
      ),
    },
    {
      key: "resolutionTime",
      header: "Resolution",
      priority: "secondary",
      align: "right",
      render: (sla) => (
        <div className="flex items-center justify-end gap-1 text-sm text-gray-700 dark:text-gray-300">
          <HiOutlineClock className="w-4 h-4 text-gray-400" />
          {formatMinutes(sla.resolutionTime)}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "primary",
      align: "center",
      render: (sla) =>
        sla.isActive ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
            <HiOutlineCheckCircle className="w-3 h-3" />
            Aktif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            <HiOutlineXCircle className="w-3 h-3" />
            Nonaktif
          </span>
        ),
    },
  ];

  const renderActions = (sla: SlaItem) => (
    <div className="flex items-center justify-center gap-2">
      {canUpdate && (
        <Link
          href={`/admin/workorders/slas/${sla.id}/edit`}
          className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/20 rounded transition-colors"
          title="Edit"
        >
          <FiEdit className="h-4 w-4" />
        </Link>
      )}
      {canDelete && (
        <button
          onClick={() => handleDelete(sla.id, sla.name)}
          className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Hapus"
        >
          <FiTrash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Aturan SLA Work Order
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tetapkan target response &amp; resolution time per tipe, prioritas,
            atau department.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/admin/workorders/slas/new"
            className={buttonVariants({ variant: "default" })}
          >
            <HiOutlinePlus className="h-4 w-4" />
            Tambah SLA
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={activeFilter}
          onChange={(e) =>
            setActiveFilter(e.target.value as "all" | "true" | "false")
          }
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">Semua Status</option>
          <option value="true">Hanya Aktif</option>
          <option value="false">Hanya Nonaktif</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Daftar Aturan SLA ({slas.length})
          </h2>
        </div>

        <ResponsiveTable
          data={slas}
          columns={columns}
          keyField="id"
          loading={isLoading && slas.length === 0}
          loadingMessage="Memuat aturan SLA..."
          emptyMessage="Belum ada aturan SLA. Buat aturan pertama Anda."
          renderActions={renderActions}
        />
      </div>
    </div>
  );
}
