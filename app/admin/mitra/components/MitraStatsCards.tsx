import {
  HiOutlineWrenchScrewdriver,
  HiOutlineMegaphone,
  HiOutlineCheckCircle,
  HiOutlineBanknotes,
} from "react-icons/hi2";
import type { Stats } from "./types";
import { formatCurrency } from "./types";

export interface MitraStatsCardsProps {
  readonly stats: Stats | null;
}

export function MitraStatsCards({ stats }: MitraStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
            <HiOutlineWrenchScrewdriver className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.totalTeknisi || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Mitra Teknisi
            </p>
          </div>
        </div>
      </div>
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg">
            <HiOutlineMegaphone className="w-7 h-7 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.totalSales || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Mitra Sales
            </p>
          </div>
        </div>
      </div>
      <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <HiOutlineCheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.totalActive || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Mitra Aktif
            </p>
          </div>
        </div>
      </div>
      <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <HiOutlineBanknotes className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats?.totalBalance || 0)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Saldo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
