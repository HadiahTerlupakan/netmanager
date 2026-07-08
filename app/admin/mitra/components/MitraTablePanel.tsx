"use client";

import PageLoader from "@/components/ui/PageLoader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { HiOutlineUsers } from "react-icons/hi2";
import type { ReactNode } from "react";
import type { Column } from "@/components/ui/ResponsiveTable";
import type { Mitra } from "./types";

interface MitraTablePanelProps {
  readonly loading: boolean;
  readonly mitras: readonly Mitra[];
  readonly columns: readonly Column<Mitra>[];
  readonly renderActions: (mitra: Mitra) => ReactNode;
  readonly searchTerm: string;
  readonly typeFilter: "all" | "MITRA_TEKNISI" | "MITRA_SALES";
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly setPage: React.Dispatch<React.SetStateAction<number>>;
}

export function MitraTablePanel({
  loading,
  mitras,
  columns,
  renderActions,
  searchTerm,
  typeFilter,
  page,
  totalPages,
  total,
  setPage,
}: MitraTablePanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {loading ? (
        <PageLoader variant="section" message="Memuat data mitra..." />
      ) : mitras.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <HiOutlineUsers className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Belum ada mitra
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchTerm || typeFilter !== "all"
              ? "Coba ubah filter pencarian"
              : "Mulai dengan menambahkan mitra baru"}
          </p>
        </div>
      ) : (
        <>
          <ResponsiveTable
            data={[...mitras]}
            columns={[...columns]}
            keyField="id"
            renderActions={renderActions}
          />
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {(page - 1) * 20 + 1} - {Math.min(page * 20, total)}{" "}
                dari {total} mitra
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPage((currentPage) => Math.max(1, currentPage - 1))
                  }
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Hal {page} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((currentPage) =>
                      Math.min(totalPages, currentPage + 1),
                    )
                  }
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
