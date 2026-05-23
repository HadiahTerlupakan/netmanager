"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import {
  FiEdit,
  FiTrash2,
  FiEye,
  FiPaperclip,
  FiCamera,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiMinusCircle,
  FiFileText,
  FiUser,
} from "react-icons/fi";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { useApi } from "@/lib/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { clientLogger } from "@/lib/client-logger";

interface BarangKeluar {
  id: string;
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi: "BARU" | "BEKAS" | "RUSAK";
  isHilang?: boolean;
  keterangan: string | null;
  tujuanPenggunaan?: string | null;
  tanggal: string;
  createdAt: string;
  employeeId?: string | null;
  purpose?: string | null;
  fotoBukti: string[];
  fotoMetadata?: {
    uploadedAt: string;
    count: number;
    totalSize: number;
  } | null;
  barang: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
  };
  gudang: {
    id: string;
    kode: string;
    nama: string;
  };
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface KeluarListResponse {
  keluarList: BarangKeluar[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface KeluarTableProps {
  onEdit?: ((keluar: BarangKeluar) => void) | undefined;
  onView?: ((keluar: BarangKeluar) => void) | undefined;
  refreshTrigger?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  siteId?: string;
  gudangId?: string;
}

const PAGE_LIMIT = 20;

export function KeluarTable({
  onEdit,
  onView,
  refreshTrigger = 0,
  search = "",
  startDate = "",
  endDate = "",
  siteId = "",
  gudangId = "",
}: KeluarTableProps) {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    kode: string;
    jumlah: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: PAGE_LIMIT.toString(),
    });
    if (search) params.append("search", search);
    if (startDate)
      params.append("startDate", new Date(startDate).toISOString());
    if (endDate) params.append("endDate", new Date(endDate).toISOString());
    if (siteId) params.append("siteId", siteId);
    if (gudangId) params.append("gudangId", gudangId);
    return `/api/inventory/keluar?${params.toString()}${
      refreshTrigger > 0 ? `&_r=${refreshTrigger}` : ""
    }`;
  }, [page, search, startDate, endDate, siteId, gudangId, refreshTrigger]);

  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useApi<KeluarListResponse>(url);

  const keluarList = data?.keluarList ?? [];
  const pagination = data?.pagination ?? {
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 0,
  };

  useRealtimeScope({ kind: "admin", id: "inventory" });
  useRealtimeEvent("inventory.update", () => {
    void mutate();
  });

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { id, kode } = confirmDelete;
    setDeleting(true);

    try {
      const response = await fetch(`/api/inventory/keluar/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || "Gagal menghapus record barang keluar",
        );
      }

      showToast("success", `Record barang keluar ${kode} berhasil dihapus`);
      await mutate();
      setConfirmDelete(null);
    } catch (err) {
      clientLogger.error("Failed to delete barang keluar:", err);
      showToast(
        "error",
        err instanceof Error
          ? err.message
          : "Gagal menghapus record barang keluar",
      );
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<BarangKeluar>[] = [
    {
      key: "tanggal",
      header: "Tanggal",
      priority: "primary",
      render: (item) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {new Date(item.tanggal).toLocaleDateString("id-ID")}
        </span>
      ),
    },
    {
      key: "barang",
      header: "Barang",
      priority: "primary",
      render: (item) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {item.barang.kode}
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            {item.barang.nama}
          </div>
        </div>
      ),
    },
    {
      key: "gudang",
      header: "Gudang",
      priority: "secondary",
      render: (item) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {item.gudang.kode}
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            {item.gudang.nama}
          </div>
        </div>
      ),
    },
    {
      key: "jumlah",
      header: "Jumlah",
      priority: "primary",
      render: (item) => (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400">
          -{item.jumlah} {item.barang.satuan}
        </span>
      ),
    },
    {
      key: "kondisi",
      header: "Kondisi",
      priority: "secondary",
      render: (item) => (
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
              item.kondisi === "BARU"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                : item.kondisi === "BEKAS"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
            }`}
          >
            {item.kondisi === "BARU" && (
              <>
                <FiCheckCircle className="mr-1" /> Baru
              </>
            )}
            {item.kondisi === "BEKAS" && (
              <>
                <FiAlertTriangle className="mr-1" /> Bekas
              </>
            )}
            {item.kondisi === "RUSAK" && (
              <>
                <FiXCircle className="mr-1" /> Rusak
              </>
            )}
          </span>
          {item.isHilang && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
              <FiMinusCircle className="mr-1" /> HILANG
            </span>
          )}
        </div>
      ),
    },
    {
      key: "tujuanPenggunaan",
      header: "Tujuan / Keterangan",
      priority: "tertiary",
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white max-w-xs">
          {item.tujuanPenggunaan && (
            <div className="font-medium text-indigo-600 dark:text-indigo-400 mb-1 flex items-center">
              <FiFileText className="mr-1" /> {item.tujuanPenggunaan}
            </div>
          )}
          {item.keterangan && (
            <div className="text-gray-500 dark:text-gray-400 truncate">
              {item.keterangan}
            </div>
          )}
          {!item.tujuanPenggunaan && !item.keterangan && "-"}
        </div>
      ),
    },
    {
      key: "user",
      header: "Diambil Oleh",
      priority: "tertiary",
      render: (item) =>
        item.user ? (
          <div className="text-sm">
            <div className="font-medium text-indigo-600 dark:text-indigo-400 flex items-center">
              <FiUser className="mr-1" /> {item.user.name || "Unknown"}
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">
              {item.user.email}
            </div>
            {item.purpose && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center">
                <FiFileText className="mr-1" /> {item.purpose}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Admin
          </span>
        ),
    },
    {
      key: "fotoBukti",
      header: "Foto",
      priority: "tertiary",
      align: "center",
      render: (item) =>
        item.fotoBukti && item.fotoBukti.length > 0 ? (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            <FiPaperclip className="h-3 w-3 mr-1" />
            {item.fotoBukti.length}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">
            <FiCamera className="h-4 w-4" />
          </span>
        ),
    },
  ];

  const renderActions = (item: BarangKeluar) => (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onView?.(item)}
        title="Lihat Detail"
      >
        <FiEye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onEdit?.(item)}
        title="Edit"
      >
        <FiEdit className="h-4 w-4" />
      </Button>
      <Button
        variant="destructive"
        size="icon-sm"
        onClick={() =>
          setConfirmDelete({
            id: item.id,
            kode: item.barang.kode,
            jumlah: item.jumlah,
          })
        }
        title="Hapus"
      >
        <FiTrash2 className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400">
          {error.message || "Gagal memuat data"}
        </div>
      )}

      <ResponsiveTable
        data={keluarList}
        columns={columns}
        keyField="id"
        loading={loading}
        emptyMessage="Tidak ada data barang keluar"
        loadingMessage="Memuat data..."
        renderActions={renderActions}
      />

      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 gap-3">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Menampilkan {(page - 1) * pagination.limit + 1} hingga{" "}
            {Math.min(page * pagination.limit, pagination.total)} dari{" "}
            {pagination.total} data
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Record Barang Keluar"
        description={
          confirmDelete
            ? `Apakah Anda yakin ingin menghapus record barang keluar ${confirmDelete.kode} (${confirmDelete.jumlah} pcs)? Stok barang akan ditambahkan kembali.`
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
