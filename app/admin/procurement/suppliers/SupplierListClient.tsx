"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HiOutlinePlus, HiPencil, HiTrash } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { getPphLabel } from "@/modules/tax/client";
import {
  ProcurementListCard,
  ProcurementPageShell,
  PROCUREMENT_INPUT_CLASS,
} from "../_components/ProcurementPageShell";

interface SupplierListItem {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  npwp: string | null;
  defaultPphCategory: string | null;
  status: string;
  blacklistReason: string | null;
}

interface SupplierListResponse {
  items: SupplierListItem[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Non-aktif" },
  { value: "BLACKLISTED", label: "Blacklist" },
] as const;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "Aktif",
    className: "bg-green-100 text-green-700",
  },
  INACTIVE: {
    label: "Non-aktif",
    className: "bg-gray-100 text-gray-600",
  },
  BLACKLISTED: {
    label: "Blacklist",
    className: "bg-red-100 text-red-700",
  },
};

export function SupplierListClient() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const queryString = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    page: String(page),
    limit: String(limit),
  }).toString();

  const { data, error, isLoading, mutate } = useApi<SupplierListResponse>(
    `/api/admin/procurement/suppliers?${queryString}`,
  );

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Gagal memuat data supplier");
    }
  }, [error]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus supplier "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/procurement/suppliers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || "Gagal menghapus");
      }
      toast.success("Supplier berhasil dihapus");
      await mutate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus supplier",
      );
    }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <ProcurementPageShell
      title="Master Supplier"
      subtitle="Kelola data supplier — status aktif, dokumen SIUP/NPWP, rekening, kontrak."
      backHref="/admin/procurement"
      actions={
        <Link href="/admin/procurement/suppliers/create">
          <Button>
            <HiOutlinePlus className="w-4 h-4 mr-1" />
            Tambah Supplier
          </Button>
        </Link>
      }
    >
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Cari kode, nama, atau NPWP..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={`${PROCUREMENT_INPUT_CLASS} flex-1 max-w-md`}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className={PROCUREMENT_INPUT_CLASS}
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <ProcurementListCard>
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Kode</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">NPWP</th>
              <th className="px-4 py-3 font-medium">Kategori PPh</th>
              <th className="px-4 py-3 font-medium">Kontak</th>
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Belum ada supplier.
                </td>
              </tr>
            )}
            {items.map((s) => {
              const badge = STATUS_BADGE[s.status] ?? {
                label: s.status,
                className: "bg-gray-100 text-gray-600",
              };
              return (
                <tr
                  key={s.id}
                  className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition"
                >
                  <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${badge.className}`}
                      title={s.blacklistReason ?? undefined}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.npwp ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {getPphLabel(s.defaultPphCategory) ??
                      s.defaultPphCategory ??
                      "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.email ?? s.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Link
                        href={`/admin/procurement/suppliers/${s.id}`}
                        className="p-2 text-gray-600 hover:text-blue-600"
                        title="Edit"
                      >
                        <HiPencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="p-2 text-gray-600 hover:text-red-600"
                        title="Hapus"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ProcurementListCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-600">
            Menampilkan {items.length} dari {total} supplier
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="px-3 py-1">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </ProcurementPageShell>
  );
}
