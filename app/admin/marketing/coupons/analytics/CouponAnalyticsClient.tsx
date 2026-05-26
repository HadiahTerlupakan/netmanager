"use client";

import Link from "next/link";
import { useApi } from "@/lib/hooks/useApi";
import PageLoader from "@/components/ui/PageLoader";
import {
  HiOutlineTicket,
  HiOutlineClock,
  HiOutlineFire,
  HiOutlineChartBar,
  HiOutlineArrowLeft,
} from "react-icons/hi2";

interface CouponAnalyticsResponse {
  summary: {
    totalActive: number;
    totalExpiringSoon: number;
    totalUsageLast30Days: number;
    redemptionRatePct: number;
    totalDiscountValueLast30Days: string;
  };
  topByUsage: Array<{
    couponId: string;
    code: string;
    description: string | null;
    usedCount: number;
    quota: number;
    redemptionRatePct: number;
    endDate: string;
  }>;
  expiringSoon: Array<{
    couponId: string;
    code: string;
    endDate: string;
    daysUntilExpiry: number;
    remainingQuota: number;
  }>;
}

function formatRupiah(amount: string): string {
  const value = Number(BigInt(amount));
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CouponAnalyticsClient() {
  const { data, isLoading, error } = useApi<CouponAnalyticsResponse>(
    "/api/admin/coupons/analytics",
  );

  if (isLoading) return <PageLoader />;
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
        {error.message || "Gagal memuat analytics"}
      </div>
    );
  }
  if (!data) return null;

  const { summary, topByUsage, expiringSoon } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/marketing/coupons"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <HiOutlineArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Coupons Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Performa kupon, redemption rate, dan alert kupon yang akan
            kedaluwarsa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<HiOutlineTicket className="w-6 h-6" />}
          label="Kupon Aktif"
          value={`${summary.totalActive}`}
          accent="indigo"
        />
        <SummaryCard
          icon={<HiOutlineClock className="w-6 h-6" />}
          label="Akan Kedaluwarsa (14 hari)"
          value={`${summary.totalExpiringSoon}`}
          accent={summary.totalExpiringSoon > 0 ? "orange" : "emerald"}
        />
        <SummaryCard
          icon={<HiOutlineFire className="w-6 h-6" />}
          label="Pemakaian 30 Hari"
          value={`${summary.totalUsageLast30Days}`}
          accent="sky"
        />
        <SummaryCard
          icon={<HiOutlineChartBar className="w-6 h-6" />}
          label="Redemption Rate"
          value={`${summary.redemptionRatePct.toFixed(1)}%`}
          accent="purple"
          subtext={`Estimasi diskon: ${formatRupiah(summary.totalDiscountValueLast30Days)}`}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Top 10 Kupon (by Usage)
          </h2>
        </div>
        {topByUsage.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Belum ada data pemakaian kupon.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Kode
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Deskripsi
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Dipakai
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Kuota
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Redemption
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Berakhir
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {topByUsage.map((c) => (
                <tr key={c.couponId}>
                  <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">
                    {c.code}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {c.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                    {c.usedCount}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {c.quota || "∞"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.quota > 0 ? (
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="text-xs font-semibold">
                          {c.redemptionRatePct.toFixed(0)}%
                        </span>
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500"
                            style={{
                              width: `${Math.min(c.redemptionRatePct, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {formatDate(c.endDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Akan Kedaluwarsa dalam 14 Hari
          </h2>
          {expiringSoon.length > 0 && (
            <span className="text-xs text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded">
              Perlu perhatian
            </span>
          )}
        </div>
        {expiringSoon.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Tidak ada kupon yang akan kedaluwarsa dalam waktu dekat.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {expiringSoon.map((c) => (
              <li
                key={c.couponId}
                className="px-6 py-4 flex items-center gap-4"
              >
                <div
                  className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                    c.daysUntilExpiry <= 3
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                  }`}
                >
                  <span className="text-lg font-bold">{c.daysUntilExpiry}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-semibold text-gray-900 dark:text-white">
                    {c.code}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Berakhir {formatDate(c.endDate)} • Sisa kuota{" "}
                    {c.remainingQuota || "∞"}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {c.daysUntilExpiry === 1
                    ? "1 hari lagi"
                    : `${c.daysUntilExpiry} hari lagi`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  subtext?: string;
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
  subtext,
}: SummaryCardProps) {
  const styles: Record<string, string> = {
    indigo:
      "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300",
    sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
    orange:
      "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300",
    emerald:
      "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
    purple:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            styles[accent] ?? styles.indigo
          }`}
        >
          {icon}
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {subtext}
        </p>
      )}
    </div>
  );
}
