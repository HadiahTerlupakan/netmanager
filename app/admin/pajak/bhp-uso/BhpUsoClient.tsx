"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { HiOutlinePresentationChartBar } from "react-icons/hi2";
import { usePermission } from "@/hooks/use-permission";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

interface PeriodItem {
  id: string;
  year: number;
  month: number;
  bhpAccrual: number;
  usoAccrual: number;
  bhpStatus: string;
  calculatedAt: string | null;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const STATUS_STYLES: Record<string, string> = {
  BELUM_SETOR:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  SUDAH_SETOR:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  TERLAMBAT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  BELUM_SETOR: "Belum Setor",
  SUDAH_SETOR: "Sudah Setor",
  TERLAMBAT: "Terlambat",
};

export function BhpUsoClient() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission("tax:manage");

  const [year, setYear] = useState(new Date().getFullYear());
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const fetchedRef = useRef(false);

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tax/period?year=${year}`);
      if (res.ok) {
        const json = await res.json();
        setPeriods(json.data || []);
      }
    } catch {
      toast.error("Gagal memuat data BHP & USO");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchPeriods();
    }
  }, [fetchPeriods]);

  useEffect(() => {
    if (fetchedRef.current) {
      fetchPeriods();
    }
  }, [year, fetchPeriods]);

  const handleCalculatePrevMonth = async () => {
    const now = new Date();
    const prevMonth = now.getMonth(); // 0-indexed, so this is previous month
    const calcYear =
      prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const calcMonth = prevMonth === 0 ? 12 : prevMonth;

    setCalculating(true);
    try {
      const res = await fetch(
        `/api/admin/tax/period/${calcYear}/${calcMonth}`,
        {
          method: "POST",
        },
      );
      if (res.ok) {
        toast.success(
          `Berhasil menghitung ${MONTH_NAMES[calcMonth - 1]} ${calcYear}`,
        );
        fetchPeriods();
      } else {
        const err = await res.json();
        toast.error(err.message || "Gagal menghitung");
      }
    } catch {
      toast.error("Gagal menghitung");
    } finally {
      setCalculating(false);
    }
  };

  // Compute totals
  const totalBhp = periods.reduce((sum, p) => sum + p.bhpAccrual, 0);
  const totalUso = periods.reduce((sum, p) => sum + p.usoAccrual, 0);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlinePresentationChartBar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
          BHP & USO
        </h1>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          {Array.from(
            { length: 5 },
            (_, i) => new Date().getFullYear() - 2 + i,
          ).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {canManage && (
          <button
            onClick={handleCalculatePrevMonth}
            disabled={calculating}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50"
          >
            {calculating ? "Menghitung..." : "Hitung Bulan Lalu"}
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total BHP {year}
          </p>
          <p className="text-xl font-black font-mono text-orange-600 dark:text-orange-400">
            {formatCurrency(totalBhp)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Tarif 0.5% dari pendapatan
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total USO {year}
          </p>
          <p className="text-xl font-black font-mono text-teal-600 dark:text-teal-400">
            {formatCurrency(totalUso)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Tarif 1.25% dari pendapatan
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : !periods.length ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            Belum ada data periode untuk tahun {year}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f172a]">
                  <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                    Bulan
                  </th>
                  <th className="text-right px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                    BHP (0.5%)
                  </th>
                  <th className="text-right px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                    USO (1.25%)
                  </th>
                  <th className="text-center px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {periods.map((period) => (
                  <tr
                    key={period.id}
                    className="hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {MONTH_NAMES[period.month - 1]}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatCurrency(period.bhpAccrual)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatCurrency(period.usoAccrual)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[period.bhpStatus] || ""}`}
                      >
                        {STATUS_LABELS[period.bhpStatus] || period.bhpStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
