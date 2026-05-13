"use client";

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TablePaginationFooterProps {
  pagination: PaginationState;
  loading: boolean;
  onPageChange: (page: number) => void;
}

/**
 * Footer pagination terpadu untuk halaman admin notifikasi (email logs +
 * dead letter queue). Konsolidasi style + a11y handling pada satu tempat.
 */
export function TablePaginationFooter({
  pagination,
  loading,
  onPageChange,
}: TablePaginationFooterProps) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
      <span>
        Halaman {pagination.page} dari {pagination.totalPages} &middot;{" "}
        {pagination.total} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1 || loading}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ‹ Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages || loading}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Selanjutnya ›
        </button>
      </div>
    </div>
  );
}
