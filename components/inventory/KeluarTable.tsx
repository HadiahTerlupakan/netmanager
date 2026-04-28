"use client";

import { useState, useEffect, useCallback } from "react";
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
import { getWithAuth, deleteWithAuth } from "@/lib/api-client";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
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
  const [keluarList, setKeluarList] = useState<BarangKeluar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchKeluarList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (search) params.append("search", search);
      if (startDate)
        params.append("startDate", new Date(startDate).toISOString());
      if (endDate) params.append("endDate", new Date(endDate).toISOString());
      if (siteId) params.append("siteId", siteId);
      if (gudangId) params.append("gudangId", gudangId);

      const response = await getWithAuth(`/api/inventory/keluar?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal memuat data");
      }

      const responseData = data.data || data;
      setKeluarList(responseData.keluarList || []);
      setPagination((prev) => ({
        ...prev,
        ...(responseData.pagination || {}),
      }));
    } catch (error) {
      clientLogger.error("Failed to fetch barang keluar:", error);
      setError(error instanceof Error ? error.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [page, search, startDate, endDate, siteId, gudangId]);

  // Fetch data
  useEffect(() => {
    fetchKeluarList();
  }, [fetchKeluarList, refreshTrigger]);

  useRealtimeScope({ kind: "admin", id: "inventory" });

  // Listen for inventory updates
  useRealtimeEvent("inventory.update", () => {
    clientLogger.info("[Inventory] KeluarTable received update, refreshing...");
    fetchKeluarList();
  });

  const handleDelete = async (id: string, kode: string, jumlah: number) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus record barang keluar ${kode} (${jumlah} pcs)?\n\nPeringatan: Ini akan menambah stok barang kembali!`,
      )
    ) {
      return;
    }

    try {
      const response = await deleteWithAuth(`/api/inventory/keluar/${id}`);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || "Gagal menghapus record barang keluar",
        );
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      clientLogger.error("Failed to delete barang keluar:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Gagal menghapus record barang keluar",
      );
    }
  };

  // Define columns for ResponsiveTable
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
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
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

  // Render actions for each row
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
        onClick={() => handleDelete(item.id, item.barang.kode, item.jumlah)}
        title="Hapus"
      >
        <FiTrash2 className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {/* Responsive Table */}
      <ResponsiveTable
        data={keluarList}
        columns={columns}
        keyField="id"
        loading={loading}
        emptyMessage="Tidak ada data barang keluar"
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
    </div>
  );
}
