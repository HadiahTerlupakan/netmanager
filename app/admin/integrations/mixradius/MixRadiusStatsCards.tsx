import { Button } from "@/components/ui/Button";
import { HiOutlineXCircle } from "react-icons/hi2";
import { MIXRADIUS_SOURCE_LABEL } from "./constants";

interface MixRadiusStatsCardsProps {
  viewMode: "default" | "isolir";
  totalRecords: number;
  globalTotal: number;
  page: number;
  totalPages: number;
  onClearCache: () => void;
}

/** Tampilkan ringkasan statistik utama halaman MixRadius. */
export function MixRadiusStatsCards(props: MixRadiusStatsCardsProps) {
  const {
    viewMode,
    totalRecords,
    globalTotal,
    page,
    totalPages,
    onClearCache,
  } = props;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {viewMode === "isolir" ? "Total Pelanggan Isolir" : "Total Pelanggan"}
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {totalRecords.toLocaleString()}
          {viewMode === "isolir" && (
            <span className="text-sm text-gray-500 dark:text-gray-400 font-normal ml-2">
              / {globalTotal.toLocaleString()} Total
            </span>
          )}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-500 dark:text-gray-400">Halaman</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {page + 1} / {totalPages || 1}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Source</div>
          <div className="text-lg font-medium text-blue-600 dark:text-blue-400">
            {MIXRADIUS_SOURCE_LABEL}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearCache}
          className="mt-2 flex items-center gap-2"
          title="Hapus cache dan ambil data terbaru dari MixRadius"
        >
          <HiOutlineXCircle className="w-3.5 h-3.5" />
          Bersihkan Cache
        </Button>
      </div>
    </div>
  );
}
