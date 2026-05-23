"use client";

import { Button } from "@/components/ui/Button";

const PAGE_WINDOW = 5;

type OpnameHistoryPaginationProps = {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageSelect: (page: number) => void;
};

function buildPageWindow(currentPage: number, totalPages: number): number[] {
  if (totalPages <= PAGE_WINDOW) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const half = Math.floor(PAGE_WINDOW / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + PAGE_WINDOW - 1);
  if (end - start + 1 < PAGE_WINDOW) start = Math.max(1, end - PAGE_WINDOW + 1);

  return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
}

export function OpnameHistoryPaginationBar({
  currentPage,
  totalPages,
  total,
  limit,
  onPageSelect,
}: OpnameHistoryPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageWindow(currentPage, totalPages);
  const startIndex = (currentPage - 1) * limit + 1;
  const endIndex = Math.min(currentPage * limit, total);

  return (
    <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            onClick={() => onPageSelect(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            Previous
          </Button>
          <Button
            onClick={() => onPageSelect(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            Next
          </Button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Menampilkan <span className="font-medium">{startIndex}</span>{" "}
              hingga <span className="font-medium">{endIndex}</span> dari{" "}
              <span className="font-medium">{total}</span> hasil
            </p>
          </div>
          <div>
            <nav
              className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              aria-label="Pagination"
            >
              <Button
                onClick={() => onPageSelect(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
              >
                Previous
              </Button>
              {pages.map((page) => (
                <Button
                  key={page}
                  onClick={() => onPageSelect(page)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                    currentPage === page
                      ? "z-10 bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/20"
                      : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  }`}
                >
                  {page}
                </Button>
              ))}
              <Button
                onClick={() =>
                  onPageSelect(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
              >
                Next
              </Button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
