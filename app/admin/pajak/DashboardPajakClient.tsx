"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import {
  HiOutlineReceiptPercent,
  HiOutlineChartBar,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import { usePermission } from "@/hooks/use-permission";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

interface TaxPeriodSummary {
  id: string;
  year: number;
  month: number;
  ppnKeluaran: number;
  ppnMasukan: number;
  ppnKurangBayar: number;
  pph21Total: number;
  pph23Total: number;
  pph4Total: number;
  bhpAccrual: number;
  usoAccrual: number;
  ppnStatus: string;
  pph21Status: string;
  pph23Status: string;
  pph4Status: string;
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

export function DashboardPajakClient() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission("tax:manage");

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [summary, setSummary] = useState<TaxPeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const fetchedRef = useRef(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tax/period/${year}/${month}`);
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data);
      } else if (res.status === 404) {
        setSummary(null);
      }
    } catch {
      toast.error("Gagal memuat data periode pajak");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchSummary();
    }
  }, [fetchSummary]);

  useEffect(() => {
    if (fetchedRef.current) {
      fetchSummary();
    }
  }, [year, month, fetchSummary]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch(`/api/admin/tax/period/${year}/${month}`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data);
        toast.success("Berhasil dihitung ulang");
      } else {
        const err = await res.json();
        toast.error(err.message || "Gagal menghitung ulang");
      }
    } catch {
      toast.error("Gagal menghitung ulang");
    } finally {
      setRecalculating(false);
    }
  };

  const handleMarkPaid = async (taxType: string) => {
    setMarkingPaid(taxType);
    try {
      const res = await fetch(
        `/api/admin/tax/period/${year}/${month}/mark-paid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taxType }),
        },
      );
      if (res.ok) {
        toast.success(`${taxType} ditandai sudah setor`);
        fetchSummary();
      } else {
        const err = await res.json();
        toast.error(err.message || "Gagal menandai");
      }
    } catch {
      toast.error("Gagal menandai sudah setor");
    } finally {
      setMarkingPaid(null);
    }
  };

  const totalKewajiban = summary
    ? summary.ppnKurangBayar +
      summary.pph21Total +
      summary.pph23Total +
      summary.pph4Total
    : 0;

  const statCards = summary
    ? [
        {
          label: "PPN Kurang Bayar",
          value: summary.ppnKurangBayar,
          status: summary.ppnStatus,
          taxType: "PPN_KELUARAN",
          color: "text-blue-600 dark:text-blue-400",
        },
        {
          label: "PPh 21",
          value: summary.pph21Total,
          status: summary.pph21Status,
          taxType: "PPH_21",
          color: "text-purple-600 dark:text-purple-400",
        },
        {
          label: "PPh 23",
          value: summary.pph23Total,
          status: summary.pph23Status,
          taxType: "PPH_23",
          color: "text-indigo-600 dark:text-indigo-400",
        },
        {
          label: "PPh 4(2)",
          value: summary.pph4Total,
          status: summary.pph4Status,
          taxType: "PPH_4_2",
          color: "text-pink-600 dark:text-pink-400",
        },
        {
          label: "BHP",
          value: summary.bhpAccrual,
          status: summary.bhpStatus,
          taxType: "BHP",
          color: "text-orange-600 dark:text-orange-400",
        },
        {
          label: "USO",
          value: summary.usoAccrual,
          status: summary.bhpStatus,
          taxType: "USO",
          color: "text-teal-600 dark:text-teal-400",
        },
      ]
    : [];

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlineReceiptPercent className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
          Dashboard Pajak
        </h1>
      </div>

      {/* Year/Month Selector */}
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
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={i} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        {canManage && (
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            <HiOutlineArrowPath
              className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`}
            />
            Hitung Ulang
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : !summary ? (
        <div className="bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-gray-100 dark:border-gray-800 text-center">
          <HiOutlineChartBar className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Belum ada data pajak untuk {MONTH_NAMES[month - 1]} {year}
          </p>
          {canManage && (
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50"
            >
              Hitung Sekarang
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Hero Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl" />
            <p className="text-sm font-medium text-indigo-100 mb-1">
              Total Kewajiban Pajak — {MONTH_NAMES[month - 1]} {year}
            </p>
            <p className="text-3xl font-black font-mono">
              {formatCurrency(totalKewajiban)}
            </p>
            {summary.calculatedAt && (
              <p className="text-xs text-indigo-200 mt-2">
                Terakhir dihitung:{" "}
                {new Date(summary.calculatedAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card) => (
              <div
                key={card.taxType}
                className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
              >
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                  {card.label}
                </p>
                <p className={`text-xl font-black font-mono ${card.color}`}>
                  {formatCurrency(card.value)}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[card.status] || ""}`}
                  >
                    {STATUS_LABELS[card.status] || card.status}
                  </span>
                  {canManage && card.status === "BELUM_SETOR" && (
                    <button
                      onClick={() => handleMarkPaid(card.taxType)}
                      disabled={markingPaid === card.taxType}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                    >
                      Tandai Setor
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
