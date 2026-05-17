"use client";

import { clientLogger } from "@/lib/client-logger";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  HiOutlineArrowLeft,
  HiOutlineBriefcase,
  HiOutlineChartBar,
  HiOutlineCurrencyDollar,
  HiOutlineUsers,
} from "react-icons/hi2";
import InvestorBottomNav from "../../components/InvestorBottomNav";
import { formatCurrency } from "@/lib/utils";
import { useApi } from "@/lib/hooks/useApi";

interface ProjectResponse {
  project?: Record<string, unknown>;
}

export default function InvestorProjectDetail() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const {
    data,
    isLoading,
    error: fetchError,
  } = useApi<ProjectResponse>(id ? `/api/investor/projects/${id}` : null);
  const project = data?.project ?? null;

  useEffect(() => {
    if (!fetchError) return;
    if (fetchError.status === 401) {
      router.push("/investor/login");
    } else {
      clientLogger.error("Project fetch error:", fetchError);
    }
  }, [fetchError, router]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-black">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
        <InvestorBottomNav />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-black items-center justify-center p-6 text-center">
        <HiOutlineBriefcase className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Proyek Tidak Ditemukan
        </h3>
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-2 bg-gray-200 dark:bg-neutral-800 rounded-full text-sm font-bold"
        >
          Kembali
        </button>
      </div>
    );
  }

  // Summing actual achievements for the investor
  let totalActualProfitShare = 0;
  const achievements =
    (project.actualAchievements as Record<string, unknown>[]) || [];
  achievements.forEach((ach) => {
    const netActual = Math.max(
      0,
      Number(ach.achievedRevenue) - Number(ach.opex || 0),
    );
    totalActualProfitShare +=
      netActual * (Number(project.profitSharePercent) / 100);
  });

  // Calculate average actual profit per month (if there are achievements)
  const averageActualProfitShare =
    achievements.length > 0 ? totalActualProfitShare / achievements.length : 0;

  const subs = project.subscribers as
    | { paymentRatio?: number; paying?: number; total?: number }
    | undefined;
  const paymentRatio = subs?.paymentRatio || 0;

  // Helper status badge UI for new RabStatus
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      case "PENDING_APPROVAL":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "PENGADAAN":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "PENGGELARAN_JARINGAN":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "PENJUALAN":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
      case "TARGET_TERCAPAI":
        return "bg-emerald-500 text-white";
      case "SELESAI":
        return "bg-gray-800 text-white dark:bg-white dark:text-gray-900";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };
  const status = String(project.status || "DRAFT");

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-24 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 py-4 sticky top-0 z-30 flex items-center gap-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="p-2 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full transition-colors active:scale-95"
        >
          <HiOutlineArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1 truncate pr-2">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-sm font-black text-gray-900 dark:text-white truncate">
              {String(project.name || "")}
            </h1>
            <span
              className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${getStatusStyle(status)}`}
            >
              {status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold truncate uppercase tracking-tight">
              {String(project.siteName || "Lokasi Global")}
            </p>
            {project.billingSource === "MIXRADIUS" ? (
              <span className="text-[8px] font-black text-indigo-500 uppercase">
                MixRadius
              </span>
            ) : project.billingSource === "INTERNAL" ? (
              <span className="text-[8px] font-black text-blue-500 uppercase">
                Internal
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Highlight Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-3xl text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
            <div className="absolute -right-2 -bottom-2 opacity-10">
              <HiOutlineCurrencyDollar className="w-20 h-20" />
            </div>
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider mb-1 relative z-10">
              Nilai Investasi
            </p>
            <p className="text-base font-black relative z-10">
              {formatCurrency(Number(project.investmentAmount))}
            </p>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 p-4 rounded-3xl shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Bagi Hasil
            </p>
            <p className="text-xl font-black text-gray-900 dark:text-white">
              {String(project.profitSharePercent || 0)}%
            </p>
          </div>
        </div>

        {/* Progress Profit */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-neutral-800 line-clamp-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-full">
              <HiOutlineChartBar className="w-5 h-5 text-green-600 ml-0" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Performa Keuangan
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 font-medium tracking-wide">
                  Estimasi Pendapatan Berjalan (Gross)
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(Number(project.estimatedCurrentRevenue || 0))}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50 dark:border-neutral-800">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 font-medium tracking-wide">
                  Rata-rata Profit Aktual/Bln
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(averageActualProfitShare)}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50 dark:border-neutral-800">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-green-600 dark:text-green-400 font-bold uppercase tracking-wide">
                  Total Profit Aktual (Akumulasi)
                </span>
                <span className="font-black text-green-600 dark:text-green-400">
                  {formatCurrency(totalActualProfitShare)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Subscribers Stats */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-neutral-800 line-clamp-2">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-full">
                <HiOutlineUsers className="w-5 h-5 text-purple-600 ml-0" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Pelanggan Proyek
              </h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase">
                Target
              </p>
              <p className="text-sm font-black text-gray-900 dark:text-white">
                {String(project.targetSubscribers || 0)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                  Aktif & Lunas
                </p>
                <p className="text-lg font-black text-green-600 dark:text-green-400">
                  {subs?.paying || 0}{" "}
                  <span className="text-xs text-gray-400 font-medium">PLG</span>
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                  Subscribers Total
                </p>
                <p className="text-lg font-black text-gray-900 dark:text-white">
                  {subs?.total || 0}{" "}
                  <span className="text-xs text-gray-400 font-medium">PLG</span>
                </p>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-gray-500">
                  Kesehatan Tagihan (Payment Ratio)
                </span>
                <span
                  className={
                    paymentRatio > 80
                      ? "text-green-500"
                      : paymentRatio > 50
                        ? "text-yellow-500"
                        : "text-red-500"
                  }
                >
                  {paymentRatio}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${paymentRatio > 80 ? "bg-green-500" : paymentRatio > 50 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${paymentRatio}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* History Record */}
        <div className="pt-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 px-2">
            Riwayat Pencapaian Bulanan
          </h3>
          {!achievements || achievements.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 dark:bg-neutral-900 rounded-3xl border border-gray-100 dark:border-neutral-800">
              <p className="text-sm text-gray-500">
                Belum ada pencapaian bulanan tercatat.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {achievements.map((ach) => {
                const netActual = Math.max(
                  0,
                  Number(ach.achievedRevenue) - Number(ach.opex || 0),
                );
                const investorShare =
                  netActual * (Number(project.profitSharePercent) / 100);
                return (
                  <div
                    key={String(ach.id)}
                    className="bg-white dark:bg-neutral-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-neutral-800 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-1">
                        Bulan {String(ach.month)} - {String(ach.year)}
                      </p>
                      <p className="text-sm font-black text-gray-900 dark:text-white">
                        Rev: {formatCurrency(Number(ach.achievedRevenue))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                        Hak Anda
                      </p>
                      <p className="text-sm font-black text-green-600 dark:text-green-400">
                        +{formatCurrency(investorShare)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <InvestorBottomNav />
    </div>
  );
}
