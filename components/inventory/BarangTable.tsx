"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FiEdit, FiTrash2, FiEye, FiSearch } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { usePermission } from "@/hooks/use-permission";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { clientLogger } from "@/lib/client-logger";
import { useApi } from "@/lib/hooks/useApi";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { STOCK_THRESHOLD } from "@/modules/inventory/client";

interface Barang {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  totalStock: number;
  stockPerGudang: Array<{
    gudangId: string;
    gudangKode: string;
    gudangNama: string;
    stok: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface GudangItem {
  id: string;
  kode: string;
  nama: string;
}

interface BarangListResponse {
  barangs: Barang[];
  pagination: Pagination;
}

interface GudangListResponse {
  gudangs: GudangItem[];
}

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

export function BarangTable() {
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("barang:update");
  const canDelete = hasPermission("barang:delete");
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const [gudangId, setGudangId] = useState("");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    kode: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search to reduce API calls
  const debouncedSearch = useDebounce(search, 500);

  useRealtimeScope({ kind: "admin", id: "inventory" });

  // Fetch gudangs for filter
  const { data: gudangData } = useApi<GudangListResponse>(
    "/api/inventory/gudang?view=all",
  );
  const gudangs: GudangItem[] = gudangData?.gudangs ?? [];

  // Build query string for barang list
  const barangUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "10",
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(gudangId && { gudangId }),
    });
    return `/api/inventory/barang?${params.toString()}`;
  }, [page, debouncedSearch, gudangId]);

  const {
    data: barangData,
    error,
    isLoading,
    mutate,
  } = useApi<BarangListResponse>(barangUrl);

  const barangs: Barang[] = barangData?.barangs ?? [];
  const pagination: Pagination = barangData?.pagination ?? DEFAULT_PAGINATION;

  if (error) {
    clientLogger.error("Failed to fetch barang:", error);
  }

  // Listen for inventory updates
  useRealtimeEvent("inventory.update", () => {
    void mutate();
  });

  const errorMessage = error ? error.message || "Gagal memuat data" : null;

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { id, kode } = confirmDelete;
    setDeleting(true);

    try {
      const response = await fetch(`/api/inventory/barang/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal menghapus barang");
      }

      showToast("success", `Barang ${kode} berhasil dihapus`);
      await mutate();
      setConfirmDelete(null);
    } catch (deleteError) {
      clientLogger.error("Failed to delete barang:", deleteError);
      showToast(
        "error",
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus barang",
      );
    } finally {
      setDeleting(false);
    }
  };

  // Define columns for ResponsiveTable
  const columns: Column<Barang>[] = [
    {
      key: "kode",
      header: "Kode",
      priority: "primary",
      render: (item) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {item.kode}
        </span>
      ),
    },
    {
      key: "nama",
      header: "Nama Barang",
      priority: "primary",
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white font-medium">
          {item.nama}
        </div>
      ),
    },
    {
      key: "satuan",
      header: "Satuan",
      priority: "secondary",
      align: "center",
      render: (item) => (
        <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          {item.satuan}
        </span>
      ),
    },
    {
      key: "totalStock",
      header: "Total Stok",
      priority: "primary",
      align: "center",
      render: (item) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            item.totalStock <= STOCK_THRESHOLD.OUT
              ? "bg-red-100 text-red-800"
              : item.totalStock < STOCK_THRESHOLD.LOW
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
          }`}
        >
          {item.totalStock}
        </span>
      ),
    },
    {
      key: "stockPerGudang",
      header: "Stok per Gudang",
      priority: "tertiary",
      render: (item) => (
        <div className="max-w-xs">
          {item.stockPerGudang.length === 0 ? (
            <span className="text-sm text-gray-500 italic">Tidak ada stok</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {item.stockPerGudang.slice(0, 3).map((stock, idx) => (
                <div
                  key={`${stock.gudangId}-${idx}`}
                  className="inline-flex items-center"
                  title={`${stock.gudangNama}: ${stock.stok}`}
                >
                  <span className="text-xs text-gray-600 dark:text-gray-400 mr-1">
                    {stock.gudangNama}:
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded ${
                      stock.stok <= STOCK_THRESHOLD.OUT
                        ? "bg-red-100 text-red-800"
                        : stock.stok < STOCK_THRESHOLD.LOW
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                    }`}
                  >
                    {stock.stok}
                  </span>
                </div>
              ))}
              {item.stockPerGudang.length > 3 && (
                <span className="text-xs text-gray-500 italic">
                  +{item.stockPerGudang.length - 3} lagi
                </span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "Update",
      priority: "tertiary",
      align: "center",
      render: (item) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {new Date(item.updatedAt).toLocaleDateString("id-ID")}
        </span>
      ),
    },
  ];

  // Render actions for each row
  const renderActions = (item: Barang) => (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/inventory/barang/${item.id}`}
        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded transition-colors"
        title="Detail"
      >
        <FiEye className="h-4 w-4" />
      </Link>
      {canUpdate && (
        <Link
          href={`/admin/inventory/barang/${item.id}/edit`}
          className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/20 rounded transition-colors"
          title="Edit"
        >
          <FiEdit className="h-4 w-4" />
        </Link>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setConfirmDelete({ id: item.id, kode: item.kode })}
          className="text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
          title="Hapus"
        >
          <FiTrash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div>
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex-1 min-w-[200px] relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari barang..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div className="min-w-[150px]">
          <select
            value={gudangId}
            onChange={(e) => {
              setGudangId(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Semua Gudang</option>
            {gudangs.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsive Table */}
      <ResponsiveTable
        data={barangs}
        columns={columns}
        keyField="id"
        loading={isLoading}
        emptyMessage="Tidak ada data barang"
        loadingMessage="Memuat data..."
        renderActions={renderActions}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 gap-3">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Menampilkan {(page - 1) * pagination.limit + 1} hingga{" "}
            {Math.min(page * pagination.limit, pagination.total)} dari{" "}
            {pagination.total} data
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {page} of {pagination.totalPages}
            </span>
            <Button
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Barang"
        description={
          confirmDelete
            ? `Apakah Anda yakin ingin menghapus barang ${confirmDelete.kode}? Tindakan ini tidak dapat dibatalkan.`
            : ""
        }
        confirmText={deleting ? "Menghapus..." : "Hapus"}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleting) setConfirmDelete(null);
        }}
      />
    </div>
  );
}
