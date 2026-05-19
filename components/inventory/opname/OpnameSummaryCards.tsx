"use client";

import type { OpnameCalculationSummary } from "./useOpnameCalculation";

interface OpnameSummaryCardsProps {
  gudangNama: string | undefined;
  summary: OpnameCalculationSummary;
}

export function OpnameSummaryCards({
  gudangNama,
  summary,
}: OpnameSummaryCardsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Ringkasan Inventory {gudangNama}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
            Total Jenis Barang
          </p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
            {summary.totalBarang}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-sm font-medium text-green-900 dark:text-green-300">
            Total Stok Sistem
          </p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-300">
            {summary.totalStok}
          </p>
        </div>
      </div>
      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Instruksi:</strong> Bandingkan stok sistem dengan stok fisik
          yang Anda hitung. Input jumlah stok fisik yang sebenarnya dan
          breakdown kondisi aktual di lapangan.
        </p>
      </div>
    </div>
  );
}
