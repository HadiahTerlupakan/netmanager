"use client";

interface TransferPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function TransferPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: TransferPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-between">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Menampilkan {(page - 1) * limit + 1} hingga{" "}
        {Math.min(page * limit, total)} dari {total} data
      </div>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Previous
        </button>
        <span className="px-3 py-1 text-sm">
          Halaman {page} dari {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Next
        </button>
      </div>
    </div>
  );
}
