"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { toast } from "react-hot-toast";
import SalesPerformanceStats from "./SalesPerformanceStats";

interface SalesPerformanceData {
  user: {
    id: string;
    name: string | null;
  };
  period?: string;
  target: number;
  canvasing: {
    approved: number;
    rejected: number;
    pending: number;
    total: number;
    progress: number;
  };
  points?: {
    approved: number;
    approvedValue: number;
    rejected: number;
    pending: number;
    pendingValue: number;
    total: number;
    totalValue: number;
  };
  totalAllTime: number;
  totalPointsAllTime?: number;
  recentActivity: {
    id: string;
    pelangganName: string;
    status: string;
    createdAt: string;
    address: string | null;
    pointClaim?: { status: string; pointValue: number } | null;
  }[];
}

const periodLabels: Record<string, string> = {
  day: "Hari Ini",
  week: "Minggu Ini",
  month: "Bulan Ini",
  all: "Semua Waktu",
};

export default function SalesDetailClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesPerformanceData | null>(null);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "all">(
    "month",
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/users/${id}/sales-performance?period=${period}`,
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      } else {
        toast.error("Gagal memuat data performa sales");
      }
    } catch (error) {
      clientLogger.error("Error:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [id, period]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(handle);
  }, [fetchData]);

  if (loading && !data)
    return <PageLoader message="Memuat statistik sales..." />;

  if (!data)
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Data tidak ditemukan</p>
        <Link
          href="/admin/marketing/sales"
          className="text-indigo-600 hover:underline mt-2 inline-block"
        >
          Kembali ke Daftar Sales
        </Link>
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header with Period Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/marketing/sales"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <HiOutlineArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Detail Performa Sales
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Statistik canvasing untuk{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {data.user.name}
              </span>
            </p>
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(["day", "week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              disabled={loading}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === p
                  ? "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Stats */}
      <SalesPerformanceStats data={data} period={period} />
    </div>
  );
}
