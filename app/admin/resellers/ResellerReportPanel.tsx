"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { LoadErrorState } from "./LoadErrorState";
import {
  buildReportUrl,
  currentPeriod,
  formatRupiah,
  type MonthlyReport,
  type ReportFigures,
} from "./commission-ui";

const INPUT_CLASS =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";
const CELL_CLASS = "px-3 py-2 text-right tabular-nums";

const FIGURE_COLUMNS: readonly {
  readonly key: keyof ReportFigures;
  readonly label: string;
  readonly isMoney: boolean;
}[] = [
  { key: "activeCustomers", label: "Pelanggan aktif", isMoney: false },
  { key: "grossBilled", label: "Tagihan bruto", isMoney: true },
  { key: "paid", label: "Terbayar", isMoney: true },
  { key: "commissionAccrued", label: "Komisi terbit", isMoney: true },
  { key: "commissionSettled", label: "Disettle", isMoney: true },
  { key: "commissionPaid", label: "Dibayar", isMoney: true },
  { key: "commissionAdjusted", label: "Koreksi", isMoney: true },
];

function FigureCells({ figures }: { readonly figures: ReportFigures }) {
  return (
    <>
      {FIGURE_COLUMNS.map((column) => (
        <td key={column.key} className={CELL_CLASS}>
          {column.isMoney
            ? formatRupiah(figures[column.key])
            : figures[column.key]}
        </td>
      ))}
    </>
  );
}

/**
 * Laporan bulanan reseller per outlet: tagihan bruto (termasuk PPN, seluruhnya
 * pendapatan ISP), pelunasan, dan komisi. Bisa diunduh sebagai CSV.
 */
export function ResellerReportPanel({
  resellerId,
}: {
  readonly resellerId: string;
}) {
  const [period, setPeriod] = useState(currentPeriod);
  const reportQuery = useApi<MonthlyReport>(
    period ? buildReportUrl(resellerId, period) : null,
  );
  const report = reportQuery.data;

  return (
    <section
      aria-labelledby="reseller-report-title"
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="reseller-report-title"
            className="font-semibold text-gray-900 dark:text-white"
          >
            Laporan bulanan
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pelanggan dikelompokkan menurut outlet saat ini. Tagihan bruto
            termasuk PPN. Koreksi adalah komisi yang sudah dibayar lalu ditagih
            balik pada bulan ini.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Periode
            <input
              className={`block ${INPUT_CLASS}`}
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
          </label>
          {period && (
            <a
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              href={buildReportUrl(resellerId, period, "csv")}
              download
            >
              Unduh CSV
            </a>
          )}
        </div>
      </div>
      {reportQuery.error ? (
        <LoadErrorState
          title="Gagal memuat laporan reseller"
          error={reportQuery.error}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : !report ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>
      ) : report.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Belum ada outlet maupun pelanggan untuk reseller ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-700 dark:text-gray-200">
            <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">
                  Outlet
                </th>
                {FIGURE_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="px-3 py-2 text-right"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr
                  key={row.outletId ?? "direct"}
                  className="border-t border-gray-100 dark:border-gray-700"
                >
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {row.outletName}
                    {row.outletCode && (
                      <span className="ml-1 text-gray-400">
                        ({row.outletCode})
                      </span>
                    )}
                  </th>
                  <FigureCells figures={row} />
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 font-semibold dark:border-gray-600">
                <th scope="row" className="px-3 py-2 text-left">
                  Total
                </th>
                <FigureCells figures={report.totals} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
