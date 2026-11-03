"use client";

import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiSearch, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";

import { deleteWithAuth, getWithAuth } from "@/lib/api-client";
import { usePermission } from "@/hooks/use-permission";
import type { Jasa } from "../restock/types";
import {
  describeClientError,
  readApiErrorMessage,
} from "@/components/inventory/master-data/masterDataErrorMessage";

const PESAN_GAGAL_MUAT_JASA =
  "Daftar jasa belum bisa dimuat. Muat ulang halaman. Kalau tetap gagal, laporkan ke admin.";
const PESAN_GAGAL_HAPUS_JASA =
  "Jasa belum terhapus. Coba sekali lagi. Kalau tetap gagal, laporkan ke admin.";

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
}

type JasaListProps = {
  /** Naik setiap kali jasa tersimpan dari modal, memicu muat ulang daftar. */
  reloadKey: number;
  onEdit: (jasa: Jasa) => void;
};

/** Daftar jasa dengan pencarian, sunting, dan hapus; pembuatan jasa diurus panel tab. */
export default function JasaList({ reloadKey, onEdit }: JasaListProps) {
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("jasa:update");
  const canDelete = hasPermission("jasa:delete");

  const [jasaList, setJasaList] = useState<Jasa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchJasa = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      const res = await getWithAuth(`/api/inventory/jasa?${params}`);
      if (!res.ok)
        throw new Error(await readApiErrorMessage(res, PESAN_GAGAL_MUAT_JASA));
      const json = await res.json();
      setJasaList(json.data?.items ?? []);
    } catch (err) {
      toast.error(describeClientError(err, PESAN_GAGAL_MUAT_JASA));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchJasa();
  }, [fetchJasa, reloadKey]);

  const handleDelete = async (id: string, nama: string) => {
    if (!window.confirm(`Hapus jasa "${nama}"?`)) return;
    try {
      const res = await deleteWithAuth(`/api/inventory/jasa/${id}`);
      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, PESAN_GAGAL_HAPUS_JASA));
      }
      toast.success("Jasa berhasil dihapus");
      fetchJasa();
    } catch (err) {
      toast.error(describeClientError(err, PESAN_GAGAL_HAPUS_JASA));
    }
  };

  return (
    <div>
      <div className="px-6 py-4">
        <div className="relative max-w-sm">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[0.95rem] text-gray-400" />
          <input
            type="text"
            placeholder="Cari kode atau nama jasa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 w-full rounded-[1.5rem] border border-gray-200 bg-white pl-11 pr-4 text-sm font-medium text-gray-800 shadow-sm transition-all placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-violet-500 dark:focus:ring-violet-950/40"
          />
        </div>
      </div>

      <div className="overflow-hidden border-t border-gray-100 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          </div>
        ) : jasaList.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-black text-gray-700 dark:text-gray-200">
              {search ? "Tidak ada jasa yang cocok" : "Belum ada data jasa"}
            </p>
            <p className="mt-1 text-xs font-medium text-gray-400">
              {search
                ? "Coba kata kunci lain."
                : "Tambah jasa baru untuk memulai."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Kode
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Nama Jasa
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Satuan
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Supplier
                  </th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Harga Estimasi
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Status
                  </th>
                  {(canUpdate || canDelete) && (
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {jasaList.map((jasa, index) => (
                  <tr
                    key={jasa.id}
                    className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${index !== 0 ? "border-t border-gray-50 dark:border-gray-700" : ""}`}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">
                        {jasa.kode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {jasa.nama}
                      </span>
                      {jasa.deskripsi && (
                        <p className="mt-0.5 text-xs font-medium text-gray-400 line-clamp-1">
                          {jasa.deskripsi}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                        {jasa.satuan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {jasa.supplier?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-gray-900 dark:text-white">
                        {formatRupiah(jasa.hargaEstimasi)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                          jasa.status === "ACTIVE"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {jasa.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {canUpdate && (
                            <button
                              onClick={() => onEdit(jasa)}
                              title="Edit"
                              aria-label={`Edit ${jasa.nama}`}
                              className="inline-flex min-w-[2.25rem] items-center justify-center rounded-xl p-2 text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            >
                              <FiEdit2 className="text-[0.95rem]" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(jasa.id, jasa.nama)}
                              title="Hapus"
                              aria-label={`Hapus ${jasa.nama}`}
                              className="inline-flex min-w-[2.25rem] items-center justify-center rounded-xl p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <FiTrash2 className="text-[0.95rem]" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
