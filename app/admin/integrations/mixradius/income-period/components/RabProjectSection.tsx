"use client";

import {
  HiOutlineCalculator,
  HiOutlineClipboardDocumentList,
  HiOutlineUsers,
  HiOutlineCurrencyDollar,
  HiOutlineChartBar,
  HiOutlineArrowTrendingDown,
  HiOutlineArrowTrendingUp,
  HiOutlineBanknotes,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineInformationCircle,
  HiOutlineCalendar,
} from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";
import {
  calculateIncomePeriodRoiDisplayMetrics,
  calculateIncomePeriodSelectedPeriodMetrics,
  parseIncomePeriodNumber,
} from "../calculations";

interface RabProjectSectionProps {
  rabProject: {
    id: string;
    name: string;
    description?: string;
    status: string;
    projectedRevenue: number;
    projectedOpex: number;
    targetSubscribers?: number;
    arpu?: number;
    growthType?: "LINEAR" | "PERCENTAGE" | "CUSTOM";
    startDate?: string;
    mixRadiusGroup?: { name: string };
    items: Array<{
      id: string;
      name: string;
      category: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      expenseType?: "CAPEX" | "OPEX";
    }>;
  } | null;
  rabLoading: boolean;
  roiLoading: boolean;
  totalExpenses: number;
  totalRecords: number;
  summary: {
    profit: string;
    feeSeller: string;
    totalPlusPpn: string;
    totalTransactions: string;
  } | null;
  // ROI tracking data
  cumulativeRevenue: number;
  cumulativeExpenses: number;
  cumulativeNetIncome: number;
  cumulativeGatewayFee: number;
  projectMonthsElapsed: number;
  cumCapexFromRab: number;
  cumCapexUmum: number;
  cumOpexAktual: number;
  cumOpexUmum: number;
  cumOpexProyeksi: number;
  cumDepreciation: number;
}

export default function RabProjectSection(props: RabProjectSectionProps) {
  const {
    rabProject,
    rabLoading,
    roiLoading,
    totalExpenses,
    totalRecords,
    summary,
    cumulativeRevenue,
    cumulativeExpenses,
    cumulativeNetIncome,
    cumulativeGatewayFee,
    projectMonthsElapsed,
    cumCapexFromRab,
    cumCapexUmum,
    cumOpexAktual,
    cumOpexUmum,
    cumOpexProyeksi,
    cumDepreciation,
  } = props;

  const parseNumber = parseIncomePeriodNumber;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiOutlineCalculator className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {rabProject
              ? "Proyeksi RAB & ROI Tracking"
              : "Proyeksi RAB vs Aktual"}
          </h3>
          {rabProject && (
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                rabProject.status === "APPROVED"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : rabProject.status === "DRAFT"
                    ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
              }`}
            >
              {rabProject.status}
            </span>
          )}
        </div>
        {(rabLoading || roiLoading) && (
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {rabProject ? (
        (() => {
          const {
            totalOpexItems,
            totalCapex,
            roiPercent,
            bepReached,
            bepProgress,
            revenueProgressWidth,
            opexStatus,
            opexVariancePercent,
            estimatedBepMonthsRemaining,
          } = calculateIncomePeriodRoiDisplayMetrics({
            rabItems: rabProject.items,
            totalExpenses,
            projectedRevenue: rabProject.projectedRevenue,
            projectedOpex: rabProject.projectedOpex,
            currentProfit: parseNumber(summary?.profit || 0),
            cumulativeNetIncome,
            cumCapexFromRab,
            cumCapexUmum,
            projectMonthsElapsed,
          });

          const {
            currentProfit,
            capexItemCount,
            targetSubscribersProgressPercent,
            targetSubscribersProgressWidth,
            targetSubscribersProgressTone,
          } = calculateIncomePeriodSelectedPeriodMetrics({
            summaryProfit: summary?.profit || 0,
            totalRecords,
            targetSubscribers: rabProject.targetSubscribers,
            rabItems: rabProject.items,
          });

          const targetSubscribersProgressBarClass =
            targetSubscribersProgressTone === "full"
              ? "bg-green-500"
              : targetSubscribersProgressTone === "mid"
                ? "bg-yellow-500"
                : "bg-indigo-500";

          return (
            <div className="p-5 space-y-5">
              {/* Project Header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <HiOutlineClipboardDocumentList className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {rabProject.name}
                  </span>
                </div>
                {rabProject.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                    {rabProject.description}
                  </p>
                )}
              </div>

              {/* Period Metrics (Current Filter) */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Periode Terpilih — Aktual vs Proyeksi
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Target Subscribers */}
                  <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800 rounded-lg p-4 border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center gap-2 mb-2">
                      <HiOutlineUsers className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Target vs Aktual
                      </span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {totalRecords.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        /{" "}
                        {rabProject.targetSubscribers?.toLocaleString() || "-"}
                      </span>
                    </div>
                    {rabProject.targetSubscribers &&
                      rabProject.targetSubscribers > 0 && (
                        <div className="mt-2">
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${targetSubscribersProgressBarClass}`}
                              style={{
                                width: `${targetSubscribersProgressWidth}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {targetSubscribersProgressPercent.toFixed(1)}%
                            tercapai
                          </p>
                        </div>
                      )}
                  </div>

                  {/* Revenue vs Projection */}
                  <div className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 rounded-lg p-4 border border-green-100 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <HiOutlineCurrencyDollar className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Pendapatan vs Proyeksi
                      </span>
                    </div>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(currentProfit)}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Proyeksi: {formatCurrency(rabProject.projectedRevenue)}
                    </p>
                    {rabProject.projectedRevenue > 0 && (
                      <div className="mt-2">
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              revenueProgressWidth >= 100
                                ? "bg-green-500"
                                : "bg-green-400"
                            }`}
                            style={{ width: `${revenueProgressWidth}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CAPEX */}
                  <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                      <HiOutlineChartBar className="w-4 h-4 text-purple-500" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        CAPEX (Investasi Awal)
                      </span>
                    </div>
                    <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(totalCapex)}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {capexItemCount} item
                      {totalOpexItems > 0 &&
                        ` + OPEX: ${formatCurrency(totalOpexItems)}/bln`}
                    </p>
                  </div>

                  {/* OPEX vs Projection */}
                  <div className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-800 rounded-lg p-4 border border-orange-100 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <HiOutlineArrowTrendingDown className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        OPEX Aktual vs Proyeksi
                      </span>
                    </div>
                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(totalExpenses)}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Proyeksi: {formatCurrency(rabProject.projectedOpex)}/bln
                    </p>
                    {rabProject.projectedOpex > 0 && (
                      <p
                        className={`text-xs mt-1 font-medium ${
                          opexStatus === "under"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {opexStatus === "under"
                          ? `Di bawah anggaran (${opexVariancePercent.toFixed(1)}%)`
                          : `Melebihi anggaran (${opexVariancePercent.toFixed(1)}%)`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ROI Tracking Section (Cumulative - Lifetime) */}
              {rabProject.startDate && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <HiOutlineBanknotes className="w-4 h-4 text-emerald-500" />
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ROI Tracking — Sejak{" "}
                      {new Date(rabProject.startDate).toLocaleDateString(
                        "id-ID",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}{" "}
                      ({projectMonthsElapsed} bulan)
                    </p>
                    {roiLoading && (
                      <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Cumulative Revenue */}
                    <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Kumulatif Pendapatan
                      </span>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        {formatCurrency(cumulativeRevenue)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Profit dari MixRadius (sejak proyek dimulai)
                      </p>
                      {cumulativeGatewayFee > 0 && (
                        <p className="text-[10px] text-gray-400 flex justify-between mt-0.5">
                          <span>Est. Fee Gateway:</span>
                          <span className="text-red-400">
                            -{formatCurrency(cumulativeGatewayFee)}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Total Investasi (CAPEX) */}
                    <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Total Investasi (CAPEX)
                      </span>
                      <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                        {formatCurrency(totalCapex)}
                      </p>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <p className="text-[10px] text-gray-400 flex justify-between">
                          <span>CAPEX RAB Proyek:</span>
                          <span className="font-medium">
                            {formatCurrency(cumCapexFromRab)}
                          </span>
                        </p>
                        {cumCapexUmum > 0 && (
                          <p className="text-[10px] text-gray-400 flex justify-between">
                            <span>CAPEX Umum (alokasi):</span>
                            <span className="font-medium">
                              {formatCurrency(cumCapexUmum)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Biaya Operasional (OPEX) */}
                    <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-gray-800 rounded-lg p-4 border border-red-100 dark:border-red-800">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Biaya Operasional
                      </span>
                      <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                        {formatCurrency(cumulativeExpenses)}
                      </p>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {cumOpexProyeksi > 0 && (
                          <p className="text-[10px] text-gray-400 flex justify-between">
                            <span>
                              OPEX RAB ({projectMonthsElapsed || 1} bln):
                            </span>
                            <span className="font-medium">
                              {formatCurrency(cumOpexProyeksi)}
                            </span>
                          </p>
                        )}
                        {cumOpexAktual > 0 && (
                          <p className="text-[10px] text-gray-400 flex justify-between">
                            <span>Pengeluaran tambahan:</span>
                            <span className="font-medium">
                              {formatCurrency(cumOpexAktual)}
                            </span>
                          </p>
                        )}
                        {cumOpexUmum > 0 && (
                          <p className="text-[10px] text-gray-300 dark:text-gray-500 flex justify-between pl-2">
                            <span>
                              (termasuk umum: {formatCurrency(cumOpexUmum)})
                            </span>
                          </p>
                        )}
                        {cumDepreciation > 0 && (
                          <p className="text-[10px] text-gray-400 flex justify-between">
                            <span>Depresiasi:</span>
                            <span className="font-medium">
                              {formatCurrency(cumDepreciation)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Laba Operasional */}
                    <div
                      className={`bg-gradient-to-br rounded-lg p-4 border ${
                        cumulativeNetIncome >= 0
                          ? "from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800 border-emerald-100 dark:border-emerald-800"
                          : "from-red-50 to-white dark:from-red-900/20 dark:to-gray-800 border-red-100 dark:border-red-800"
                      }`}
                    >
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Laba Operasional
                      </span>
                      <p
                        className={`text-xl font-bold mt-1 ${
                          cumulativeNetIncome >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatCurrency(cumulativeNetIncome)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Pendapatan - Fee - Biaya Operasional
                      </p>
                    </div>

                    {/* ROI Percentage */}
                    <div
                      className={`bg-gradient-to-br rounded-lg p-4 border ${
                        roiPercent >= 100
                          ? "from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 border-green-100 dark:border-green-800"
                          : roiPercent >= 0
                            ? "from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 border-blue-100 dark:border-blue-800"
                            : "from-red-50 to-white dark:from-red-900/20 dark:to-gray-800 border-red-100 dark:border-red-800"
                      }`}
                    >
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        ROI
                      </span>
                      <p
                        className={`text-xl font-bold mt-1 ${
                          roiPercent >= 100
                            ? "text-green-600 dark:text-green-400"
                            : roiPercent >= 0
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {totalCapex > 0 ? `${roiPercent.toFixed(1)}%` : "-"}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {totalCapex > 0
                          ? `(Laba Operasional - CAPEX) / CAPEX`
                          : "Tidak ada CAPEX"}
                      </p>
                    </div>
                  </div>

                  {/* BEP Progress Bar */}
                  {totalCapex > 0 && (
                    <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {bepReached ? (
                            <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <HiOutlineXCircle className="w-5 h-5 text-yellow-500" />
                          )}
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {bepReached
                              ? "BEP Tercapai!"
                              : "Progress Menuju BEP"}
                          </span>
                        </div>
                        <span
                          className={`text-sm font-bold ${bepReached ? "text-green-600" : "text-yellow-600"}`}
                        >
                          {bepProgress.toFixed(1)}%
                        </span>
                      </div>

                      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            bepReached
                              ? "bg-gradient-to-r from-green-400 to-green-500"
                              : bepProgress >= 50
                                ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                                : "bg-gradient-to-r from-blue-400 to-blue-500"
                          }`}
                          style={{ width: `${Math.max(bepProgress, 0)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Investasi: {formatCurrency(totalCapex)}</span>
                        <span>
                          Laba Operasional:{" "}
                          {formatCurrency(Math.max(0, cumulativeNetIncome))}
                        </span>
                        {!bepReached &&
                          estimatedBepMonthsRemaining !== null && (
                            <span className="text-blue-500 font-medium">
                              Est. BEP: ~{estimatedBepMonthsRemaining} bulan
                              lagi
                            </span>
                          )}
                        {!bepReached && cumulativeNetIncome <= 0 && (
                          <span className="text-red-500 font-medium">
                            Belum bisa estimasi BEP
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Growth Info */}
                  {rabProject.growthType && rabProject.targetSubscribers && (
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-3">
                      <div className="flex items-center gap-1">
                        <HiOutlineArrowTrendingUp className="w-4 h-4 text-purple-400" />
                        <span>
                          Model:{" "}
                          <strong className="text-gray-700 dark:text-gray-300">
                            {rabProject.growthType}
                          </strong>
                        </span>
                      </div>
                      {rabProject.arpu && (
                        <div className="flex items-center gap-1">
                          <span>
                            ARPU:{" "}
                            <strong className="text-gray-700 dark:text-gray-300">
                              {formatCurrency(rabProject.arpu)}
                            </strong>
                          </span>
                        </div>
                      )}
                      {rabProject.startDate && (
                        <div className="flex items-center gap-1">
                          <HiOutlineCalendar className="w-4 h-4" />
                          <span>
                            Mulai:{" "}
                            <strong className="text-gray-700 dark:text-gray-300">
                              {new Date(
                                rabProject.startDate,
                              ).toLocaleDateString("id-ID")}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* No startDate - show hint */}
              {!rabProject.startDate && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg p-3 flex items-start gap-2">
                    <HiOutlineInformationCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        ROI Tracking belum tersedia
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Atur tanggal mulai proyek di RAB untuk mengaktifkan ROI
                        tracking kumulatif dan progress BEP.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : !rabLoading ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <HiOutlineCalculator className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium">Belum ada RAB untuk site ini</p>
          <p className="text-sm mt-1">
            Buat RAB di menu Pengeluaran &gt; RAB (Proyek) untuk melihat
            perbandingan
          </p>
        </div>
      ) : null}
    </div>
  );
}
