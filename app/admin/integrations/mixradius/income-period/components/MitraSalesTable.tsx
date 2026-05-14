"use client";

import {
  HiOutlineUsers,
  HiOutlineCheckCircle,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";

interface MitraSale {
  id: string;
  name: string;
  mixradiusOwnerNames: string[];
  mitraRateFeePelanggan: number;
}

interface IncomePeriodRecord {
  id: string;
  owner_name: string;
}

interface MitraSalesTableProps {
  mitraSales: MitraSale[];
  globalRecords: IncomePeriodRecord[];
  payouts: Array<{ referenceId?: string; amount: string | number }>;
  startDate: string;
  endDate: string;
  syncingMitra: string | null;
  isCalculatingNet: boolean;
  onSyncCommission: (
    mitra: MitraSale,
    amount: number,
    activeCount: number,
  ) => void;
}

export default function MitraSalesTable({
  mitraSales,
  globalRecords,
  payouts,
  startDate,
  endDate,
  syncingMitra,
  isCalculatingNet,
  onSyncCommission,
}: MitraSalesTableProps) {
  if (mitraSales.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <HiOutlineUsers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Ringkasan Komisi Mitra Sales
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Periode: {startDate} — {endDate}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Nama Mitra
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Owner MixRadius
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                Pelanggan Aktif (T-1)
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                Rate Fee
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                Total Komisi Settled
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                Status / Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {mitraSales.map((mitra) => {
              const activeCount = globalRecords.filter((record) =>
                mitra.mixradiusOwnerNames.some((owner) =>
                  record.owner_name
                    ?.toLowerCase()
                    .includes(owner.toLowerCase()),
                ),
              ).length;

              const totalPotentialFee =
                activeCount * (mitra.mitraRateFeePelanggan || 0);
              const periodKey = startDate.substring(0, 7);

              const syncedAmount = payouts
                .filter(
                  (tx) =>
                    tx.referenceId?.startsWith(
                      `PAYOUT-FEE-${periodKey}-${mitra.id}-`,
                    ) ||
                    tx.referenceId === `PAYOUT-FEE-${periodKey}-${mitra.id}`,
                )
                .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

              const remainingFee = Math.max(
                0,
                totalPotentialFee - syncedAmount,
              );
              const isFullyPaid = remainingFee <= 0 && totalPotentialFee > 0;

              return (
                <tr
                  key={mitra.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {mitra.name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {mitra.mixradiusOwnerNames.map((owner, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-[10px]"
                        >
                          {owner}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">
                    {activeCount}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    {formatCurrency(mitra.mitraRateFeePelanggan)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(totalPotentialFee)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isFullyPaid ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs font-bold">
                        <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                        FULL SYNCED
                      </span>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        {syncedAmount > 0 && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Sisa: {formatCurrency(remainingFee)}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            onSyncCommission(mitra, remainingFee, activeCount)
                          }
                          disabled={
                            syncingMitra === mitra.id ||
                            remainingFee <= 0 ||
                            isCalculatingNet
                          }
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                          <HiOutlineArrowPath
                            className={`w-4 h-4 ${syncingMitra === mitra.id ? "animate-spin" : ""}`}
                          />
                          Sync Sisa ke Wallet
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
