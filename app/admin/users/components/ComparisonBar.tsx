import Link from "next/link";
import { HiOutlineStar } from "react-icons/hi2";

interface ComparisonBarProps {
  selectedUserIds: string[];
  clearSelection: () => void;
}

/**
 * Floating comparison bar for selected users.
 */
export function ComparisonBar({
  selectedUserIds,
  clearSelection,
}: ComparisonBarProps) {
  if (selectedUserIds.length === 0) return null;

  const canCompare = selectedUserIds.length >= 2;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-indigo-100 dark:border-indigo-900 px-6 py-4 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {selectedUserIds.length} Pengguna Terpilih
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Pilih minimal 2 untuk membandingkan
        </span>
      </div>

      <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="flex items-center gap-3">
        <button
          onClick={clearSelection}
          className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Batal
        </button>
        <Link
          href={`/admin/users/compare?ids=${selectedUserIds.join(",")}`}
          className={`px-6 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 ${
            canCompare
              ? "bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white translate-y-0 opacity-100 shadow-indigo-200 dark:shadow-indigo-900/20"
              : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed pointer-events-none"
          }`}
        >
          <HiOutlineStar className="w-4 h-4" />
          Bandingkan Kinerja
        </Link>
      </div>
    </div>
  );
}
