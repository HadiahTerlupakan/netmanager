"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  HiOutlineGift,
  HiOutlineStar,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineMapPin,
} from "react-icons/hi2";

interface SalesPerformanceData {
  user: { id: string; name: string; canvasingTarget: number };
  period: string;
  target: number;
  canvasing: {
    approved: number;
    rejected: number;
    pending: number;
    total: number;
    progress: number;
  };
  points: {
    approved: number;
    approvedValue: number;
    rejected: number;
    pending: number;
    pendingValue: number;
    total: number;
    totalValue: number;
  };
  totalAllTime: number;
  totalPointsAllTime: number;
  recentActivity: Array<{
    id: string;
    pelangganName: string;
    status: string;
    createdAt: string;
    address: string;
    pointClaims?: { status: string; pointValue: number } | null;
  }>;
}

const periodLabels: Record<string, string> = {
  day: "Hari Ini",
  week: "Minggu Ini",
  month: "Bulan Ini",
  all: "Semua Waktu",
};

export default function SalesPerformanceStats({ userId }: { userId: string }) {
  const [data, setData] = useState<SalesPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "all">(
    "month",
  );

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/users/${userId}/sales-performance?period=${period}`,
        );
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch (err) {
        clientLogger.error("Error fetching sales performance:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchStats();
  }, [userId, period]);

  if (loading && !data)
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 animate-pulse h-64"></div>
    );

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header with Period Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <HiOutlineGift className="w-6 h-6 text-emerald-500" />
          Performa Sales & Canvasing
        </h2>

        {/* Period Filter */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(["day", "week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === p
                  ? "bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Canvasing Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <HiOutlineMapPin className="w-5 h-5 text-emerald-500" />
              Canvasing
            </h3>
            <span className="text-xs font-medium bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full dark:bg-emerald-900/30 dark:text-emerald-300">
              {periodLabels[period]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg text-center">
              <p className="text-xs text-emerald-600 dark:text-emerald-300 uppercase font-bold">
                Disetujui
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-200">
                {data.canvasing.approved}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500 uppercase font-bold">Total</p>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">
                {data.canvasing.total}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Target: {data.target}/bulan</span>
              <span>{data.canvasing.progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(data.canvasing.progress, 100)}%` }}
                className="h-full bg-emerald-500 rounded-full transition-all"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Pending: {data.canvasing.pending}</span>
              <span>Ditolak: {data.canvasing.rejected}</span>
            </div>
          </div>
        </div>

        {/* 2. Points Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <HiOutlineStar className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              Poin
            </h3>
            <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full dark:bg-yellow-900/30 dark:text-yellow-300">
              {periodLabels[period]}
            </span>
          </div>

          <div className="text-center mb-4">
            <p className="text-4xl font-bold text-yellow-600 dark:text-yellow-400">
              {data.points.approvedValue}
            </p>
            <p className="text-xs text-gray-500">Poin Disetujui</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <span className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <HiOutlineCheckCircle className="w-4 h-4" />
                Approved
              </span>
              <span className="font-bold">
                {data.points.approved} claim ({data.points.approvedValue} pts)
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <HiOutlineClock className="w-4 h-4" />
                Pending
              </span>
              <span className="font-bold">
                {data.points.pending} claim ({data.points.pendingValue} pts)
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <HiOutlineXCircle className="w-4 h-4" />
                Rejected
              </span>
              <span className="font-bold">{data.points.rejected} claim</span>
            </div>
          </div>
        </div>

        {/* 3. All Time Summary */}
        <div className="bg-linear-to-br from-emerald-500 to-teal-600 rounded-xl p-6 shadow-sm text-white">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <HiOutlineStar className="w-5 h-5" />
            Total Sepanjang Waktu
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-emerald-100">Total Canvasing</span>
              <span className="text-2xl font-bold">{data.totalAllTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-emerald-100">Total Poin</span>
              <span className="text-2xl font-bold">
                {data.totalPointsAllTime}
              </span>
            </div>
            <div className="pt-4 border-t border-emerald-400/30 text-xs text-emerald-100">
              Target bulanan: {data.target} canvasing
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Aktivitas Terbaru
          </h3>
          <div className="space-y-3">
            {data.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {activity.pelangganName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {activity.address}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {activity.pointClaims && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        activity.pointClaims.status === "APPROVED"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : activity.pointClaims.status === "PENDING"
                            ? "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      ⭐ {activity.pointClaims.pointValue} pts
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      activity.status === "APPROVED"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : activity.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {activity.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(activity.createdAt), "dd MMM", {
                      locale: idLocale,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
