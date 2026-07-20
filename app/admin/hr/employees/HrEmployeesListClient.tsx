"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { useApi } from "@/lib/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import PageLoader from "@/components/ui/PageLoader";
import type { UserListItemDTO } from "@/modules/users";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_LIMIT = "100";

interface UserListPayload {
  users: UserListItemDTO[];
  meta?: {
    total: number;
    active: number;
    inactive: number;
  };
}

/**
 * Daftar pegawai untuk HR: penempatan & link ke detail kepegawaian.
 * Akun login dikelola di menu Pengguna.
 * Fetch via useApi (TanStack Query) — hindari setState di effect.
 */
export function HrEmployeesListClient() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      limit: PAGE_LIMIT,
      page: "1",
    });
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    return `/api/admin/users?${params.toString()}`;
  }, [debouncedSearch]);

  const { data, isLoading, error } = useApi<UserListPayload>(endpoint, {
    onError: () => {
      toast.error("Gagal memuat data pegawai");
    },
  });

  const users = data?.users ?? [];

  if (isLoading && !data) {
    return <PageLoader />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Data Pegawai
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola penempatan, jam kerja, dan kuota cuti. Akun login ada di menu
            Pengguna.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Kelola akun Pengguna →
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama atau email..."
        className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      />

      {error && !data ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Gagal memuat data. Coba muat ulang halaman.
        </p>
      ) : null}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Departemen</th>
              <th className="px-4 py-3 font-medium">Site</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {user.name || "—"}
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                    {user.email}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {user.departments?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {user.sites?.name ?? user.sites?.code ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/hr/employees/${user.id}`}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    Kelola kepegawaian
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && !isLoading && (
          <p className="p-8 text-center text-gray-500 dark:text-gray-400">
            Tidak ada data
          </p>
        )}
      </div>
    </div>
  );
}
