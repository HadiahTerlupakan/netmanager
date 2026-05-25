"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";
import { HiOutlineArrowPath, HiOutlineUsers } from "react-icons/hi2";

interface CohortRow {
  id: string;
  cohortYear: number;
  cohortMonth: number;
  initialCustomers: number;
  month0Revenue: string;
  month1Revenue: string;
  month3Revenue: string;
  month6Revenue: string;
  month12Revenue: string;
  activeMonth0: number;
  activeMonth1: number;
  activeMonth3: number;
  activeMonth6: number;
  activeMonth12: number;
  updatedAt: string;
}

interface CohortResponse {
  cohorts: CohortRow[];
}

const CHECKPOINTS = [
  { key: "0", label: "M0" },
  { key: "1", label: "M1" },
  { key: "3", label: "M3" },
  { key: "6", label: "M6" },
  { key: "12", label: "M12" },
] as const;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function formatRupiahCompact(amount: string): string {
  const value = Number(BigInt(amount));
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function retentionPct(active: number, initial: number): number {
  return initial > 0 ? (active / initial) * 100 : 0;
}

function pctColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500 dark:bg-emerald-400";
  if (pct >= 60) return "bg-sky-500 dark:bg-sky-400";
  if (pct >= 40) return "bg-yellow-500 dark:bg-yellow-400";
  if (pct >= 20) return "bg-orange-500 dark:bg-orange-400";
  return "bg-red-500 dark:bg-red-400";
}

export function CustomerCohortClient() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, mutate } = useApi<CohortResponse>(
    "/api/admin/finance/customer-cohort?months=12",
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        "/api/admin/finance/customer-cohort?recompute=true&months=12",
      );
      if (res.ok) await mutate();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
        {error.message || "Gagal memuat data"}
      </div>
    );
  }
  if (!data) return null;

  const { cohorts } = data;
  const totalCustomers = cohorts.reduce(
    (acc, c) => acc + c.initialCustomers,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Customer Cohort Retention
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Retention &amp; revenue per generasi pelanggan (12 bulan terakhir).
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="default">
          <HiOutlineArrowPath
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Computing..." : "Refresh"}
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
          <HiOutlineUsers className="w-6 h-6 text-indigo-700 dark:text-indigo-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Pelanggan dalam 12 Cohort Terakhir
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {totalCustomers.toLocaleString("id-ID")} pelanggan
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Retention Heatmap
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Persentase pelanggan yang masih aktif di bulan ke-N setelah signup.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Cohort
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Signup
                </th>
                {CHECKPOINTS.map((cp) => (
                  <th
                    key={cp.key}
                    className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase"
                  >
                    {cp.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {cohorts.map((row) => {
                const active = {
                  "0": row.activeMonth0,
                  "1": row.activeMonth1,
                  "3": row.activeMonth3,
                  "6": row.activeMonth6,
                  "12": row.activeMonth12,
                };
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                      {MONTH_NAMES[row.cohortMonth - 1]} {row.cohortYear}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {row.initialCustomers}
                    </td>
                    {CHECKPOINTS.map((cp) => {
                      const cnt = active[cp.key as keyof typeof active];
                      const pct = retentionPct(cnt, row.initialCustomers);
                      const hasData = cnt > 0 || row.initialCustomers > 0;
                      return (
                        <td
                          key={cp.key}
                          className="px-4 py-3 text-center"
                          title={`${cnt} aktif dari ${row.initialCustomers}`}
                        >
                          {hasData ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                {pct.toFixed(0)}%
                              </span>
                              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${pctColor(pct)}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {cohorts.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + CHECKPOINTS.length}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    Belum ada data cohort. Klik &quot;Refresh&quot; untuk
                    compute pertama kali.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Revenue Per Cohort
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Total MRR yang masih dihasilkan tiap cohort di bulan ke-N.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Cohort
                </th>
                {CHECKPOINTS.map((cp) => (
                  <th
                    key={cp.key}
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase"
                  >
                    {cp.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {cohorts.map((row) => {
                const revenue = {
                  "0": row.month0Revenue,
                  "1": row.month1Revenue,
                  "3": row.month3Revenue,
                  "6": row.month6Revenue,
                  "12": row.month12Revenue,
                };
                return (
                  <tr key={`rev-${row.id}`}>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                      {MONTH_NAMES[row.cohortMonth - 1]} {row.cohortYear}
                    </td>
                    {CHECKPOINTS.map((cp) => {
                      const amount = revenue[cp.key as keyof typeof revenue];
                      const isZero = BigInt(amount) === 0n;
                      return (
                        <td
                          key={cp.key}
                          className="px-4 py-3 text-right text-xs"
                        >
                          {isZero ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">
                              Rp {formatRupiahCompact(amount)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
