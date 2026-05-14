"use client";

import {
  HiOutlineCog,
  HiOutlineInformationCircle,
  HiOutlineArrowTrendingUp,
  HiOutlineArrowTrendingDown,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { parseIncomePeriodNumber } from "../calculations";

interface SummaryCardsProps {
  summary: {
    profit: string;
    feeSeller: string;
    totalPlusPpn: string;
    totalTransactions: string;
  } | null;
  loading: boolean;
  isCalculatingNet: boolean;
  netIncome: number;
  estGatewayFee: number;
  totalExpenses: number;
  specificExpenses: number;
  allocatedExpenses: number;
  totalRecords: number;
  onOpenFeeModal: () => void;
}

export default function SummaryCards(props: SummaryCardsProps) {
  const {
    summary,
    loading,
    isCalculatingNet,
    netIncome,
    estGatewayFee,
    totalExpenses,
    specificExpenses,
    allocatedExpenses,
    totalRecords,
    onOpenFeeModal,
  } = props;

  const parseNumber = parseIncomePeriodNumber;
  const isDeficit = netIncome < 0;
  const shortfall = Math.abs(netIncome);
  const grossProfit =
    parseNumber(summary?.profit) -
    parseNumber(summary?.feeSeller) -
    estGatewayFee;
  const contributionMarginPerUser =
    totalRecords > 0 ? grossProfit / totalRecords : 0;
  const neededTrxToBreakEven =
    isDeficit && contributionMarginPerUser > 0
      ? Math.ceil(shortfall / contributionMarginPerUser)
      : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {/* PROFIT */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          PROFIT (IDR)
        </p>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
          {summary ? formatCurrency(summary.profit) : "-"}
        </p>
      </div>

      {/* FEE SELLER */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          FEE SELLER (IDR)
        </p>
        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
          {summary ? formatCurrency(summary.feeSeller) : "-"}
        </p>
      </div>

      {/* FEE GATEWAY (EST) */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {isCalculatingNet && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            FEE GATEWAY (EST)
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenFeeModal}
            className="p-1 h-auto"
          >
            <HiOutlineCog className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors" />
          </Button>
        </div>
        <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
          {formatCurrency(estGatewayFee)}
        </p>
      </div>

      {/* PENGELUARAN (SITE) */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {isCalculatingNet && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            PENGELUARAN (SITE)
          </p>
          <div className="group relative">
            <HiOutlineInformationCircle className="w-5 h-5 text-gray-400 cursor-help hover:text-blue-500 transition-colors" />
            <div className="absolute bottom-full mb-2 right-0 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-gray-700">
              <p className="font-semibold mb-2">Breakdown Pengeluaran:</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>SITE Langsung</span>
                  <span>{formatCurrency(specificExpenses)}</span>
                </div>
                <div className="flex justify-between">
                  <span>UMUM Alokasi Pusat</span>
                  <span>{formatCurrency(allocatedExpenses)}</span>
                </div>
                <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(totalExpenses)}</span>
                </div>
              </div>
              <div className="absolute top-full right-1 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
          {formatCurrency(totalExpenses)}
        </p>
      </div>

      {/* TOTAL + PPN */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          TOTAL + PPN (IDR)
        </p>
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
          {summary ? formatCurrency(summary.totalPlusPpn) : "-"}
        </p>
      </div>

      {/* TOTAL TRANSAKSI */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          TOTAL TRANSAKSI
        </p>
        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
          {summary ? summary.totalTransactions : "-"}
        </p>
      </div>

      {/* PENDAPATAN BERSIH (EST) */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {isCalculatingNet && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            PENDAPATAN BERSIH (EST)
          </p>
          <div className="flex items-center gap-2">
            <div className="group relative">
              <HiOutlineInformationCircle className="w-5 h-5 text-gray-400 cursor-help hover:text-blue-500 transition-colors" />
              <div className="absolute bottom-full mb-2 right-0 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-gray-700">
                <p className="font-semibold mb-2">Kalkulasi:</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Profit</span>
                    <span>{formatCurrency(parseNumber(summary?.profit))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Fee Seller</span>
                    <span>
                      {formatCurrency(parseNumber(summary?.feeSeller))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Fee Gateway (est)</span>
                    <span>{formatCurrency(estGatewayFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Pengeluaran SITE</span>
                    <span>{formatCurrency(specificExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Alokasi UMUM</span>
                    <span>{formatCurrency(allocatedExpenses)}</span>
                  </div>
                  <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between font-semibold">
                    <span>Net Income</span>
                    <span>{formatCurrency(netIncome)}</span>
                  </div>
                </div>
                <div className="absolute top-full right-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFeeModal}
              className="p-1 h-auto"
            >
              <HiOutlineCog className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors" />
            </Button>
          </div>
        </div>
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
          {formatCurrency(netIncome)}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>Gateway: {formatCurrency(estGatewayFee)}</span>
          <span>Site: {formatCurrency(specificExpenses)}</span>
          <span>Alokasi: {formatCurrency(allocatedExpenses)}</span>
        </div>
      </div>

      {/* NET ARPU (EST) */}
      <div className="col-span-1 sm:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {isCalculatingNet && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            NET ARPU (EST)
          </p>
          <div className="group relative">
            <HiOutlineInformationCircle className="w-5 h-5 text-gray-400 cursor-help hover:text-blue-500 transition-colors" />
            <div className="absolute bottom-full mb-2 right-0 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-gray-700">
              <p className="font-semibold mb-2">Average Revenue Per User</p>
              <p>
                Pendapatan bersih dibagi total transaksi. Menunjukkan kontribusi
                rata-rata per pelanggan terhadap net income.
              </p>
              <div className="absolute top-full right-1 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
        <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
          {totalRecords > 0 ? formatCurrency(netIncome / totalRecords) : "-"}
        </p>
      </div>

      {/* STATUS: DEFISIT/SURPLUS */}
      <div
        className={`col-span-1 sm:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl border shadow-sm relative overflow-hidden ${
          isDeficit
            ? "border-red-200 dark:border-red-700"
            : "border-emerald-200 dark:border-emerald-700"
        }`}
      >
        <div className="flex items-center gap-2">
          {isDeficit ? (
            <HiOutlineArrowTrendingDown className="w-5 h-5 text-red-500" />
          ) : (
            <HiOutlineArrowTrendingUp className="w-5 h-5 text-emerald-500" />
          )}
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            STATUS: {isDeficit ? "DEFISIT" : "SURPLUS"}
          </p>
        </div>
        {isDeficit ? (
          <div className="mt-1">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              -{formatCurrency(shortfall)}
            </p>
            {neededTrxToBreakEven > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Target break-even: +{neededTrxToBreakEven} transaksi
              </p>
            )}
          </div>
        ) : (
          <div className="mt-1">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              Safe Margin
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              +{formatCurrency(netIncome)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
