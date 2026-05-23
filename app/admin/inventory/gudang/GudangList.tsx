"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState } from "react";
import Link from "next/link";
import { FiPlus, FiEdit, FiTrash2, FiHome } from "react-icons/fi";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { useApi } from "@/lib/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface Gudang {
  id: string;
  kode: string;
  nama: string;
  lokasi: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GudangListResponse {
  gudangs: Gudang[];
}

export default function GudangPage() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("gudang:create");
  const canUpdate = hasPermission("gudang:update");
  const canDelete = hasPermission("gudang:delete");
  const { showToast } = useToast();

  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useApi<GudangListResponse>("/api/inventory/gudang?view=all", {
    onError: (err) => {
      clientLogger.error("Failed to fetch gudangs:", err);
    },
  });

  const gudangs = data?.gudangs ?? [];

  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    nama: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { id, nama } = confirmDelete;
    setDeleting(true);

    try {
      const response = await fetch(`/api/inventory/gudang/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal menghapus gudang");
      }

      showToast("success", `Gudang ${nama} berhasil dihapus`);
      await mutate();
      setConfirmDelete(null);
    } catch (err: unknown) {
      clientLogger.error("Failed to delete gudang:", err);
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal menghapus gudang",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Memuat data gudang...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manajemen Gudang
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola lokasi penyimpanan barang
          </p>
        </div>
        {canCreate && (
          <Link
            href="/admin/inventory/gudang/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FiPlus className="h-4 w-4 mr-2 text-white" />
            <span className="text-white">Tambah Gudang</span>
          </Link>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400">
          {error.message || "Gagal memuat data"}
        </div>
      )}

      {/* Gudang Table */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Daftar Gudang
          </h2>
        </div>

        {gudangs.length === 0 ? (
          <div className="text-center py-8">
            <FiHome className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Belum ada gudang
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Mulai dengan menambah gudang pertama Anda.
            </p>
            <div className="mt-6">
              {canCreate && (
                <Link
                  href="/admin/inventory/gudang/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FiPlus className="h-4 w-4 mr-2 text-white" />
                  <span className="text-white">Tambah Gudang</span>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden">
            <ResponsiveTable<Gudang>
              data={gudangs}
              loading={loading}
              keyField="id"
              columns={[
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
                  header: "Nama Gudang",
                  priority: "primary",
                  render: (item) => (
                    <div className="text-sm text-gray-900 dark:text-white">
                      {item.nama}
                    </div>
                  ),
                },
                {
                  key: "lokasi",
                  header: "Lokasi",
                  priority: "secondary",
                  render: (item) => (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {item.lokasi || "-"}
                    </div>
                  ),
                },
                {
                  key: "isActive",
                  header: "Status",
                  priority: "primary",
                  render: (item) => (
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {item.isActive ? "Aktif" : "Tidak Aktif"}
                    </span>
                  ),
                },
                {
                  key: "updatedAt",
                  header: "Terakhir Update",
                  priority: "tertiary",
                  render: (item) => (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.updatedAt).toLocaleDateString("id-ID")}
                    </span>
                  ),
                },
              ]}
              renderActions={(item) => (
                <div className="flex items-center gap-2">
                  {canUpdate && (
                    <Link
                      href={`/admin/inventory/gudang/${item.id}/edit`}
                      className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/20 rounded transition-colors"
                      title="Edit"
                    >
                      <FiEdit className="h-4 w-4" />
                    </Link>
                  )}
                  {canDelete && (
                    <button
                      onClick={() =>
                        setConfirmDelete({ id: item.id, nama: item.nama })
                      }
                      className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Hapus"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Gudang"
        description={
          confirmDelete
            ? `Apakah Anda yakin ingin menghapus gudang "${confirmDelete.nama}"? Tindakan ini tidak dapat dibatalkan.`
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
