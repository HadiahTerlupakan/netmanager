"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  HiOutlineChartBarSquare,
  HiOutlineCalculator,
  HiOutlineCheckCircle,
  HiOutlineBanknotes,
} from "react-icons/hi2";
import { useApi } from "@/lib/hooks/useApi";
import { usePermission } from "@/hooks/use-permission";
import PageLoader from "@/components/ui/PageLoader";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfitShareStatus = "CALCULATED" | "APPROVED" | "PAID";

interface ProfitShare {
  id: string;
  investorId: string;
  periodStart: string;
  periodEnd: string;
  netProfit: number;
  sharePercent: number;
  shareAmount: number;
  status: ProfitShareStatus;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  investor?: {
    namaLengkap: string;
    perusahaan: string | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProfitShareStatus }) {
  const map: Record<ProfitShareStatus, string> = {
    CALCULATED: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    APPROVED:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };
  const label: Record<ProfitShareStatus, string> = {
    CALCULATED: "Dihitung",
    APPROVED: "Disetujui",
    PAID: "Dibayar",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}
    >
      {label[status]}
    </span>
  );
}

function formatPeriod(start: string, end: string) {
  const s = new Date(start).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const e = new Date(end).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${s} – ${e}`;
}

// ─── Calculate Form ───────────────────────────────────────────────────────────

interface CalculateFormProps {
  onSuccess: () => void;
}

function CalculateForm({ onSuccess }: CalculateFormProps) {
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [form, setForm] = useState({
    periodStart: firstOfMonth,
    periodEnd: lastOfMonth,
    netProfit: "",
  });
  const [calculating, setCalculating] = useState(false);

  async function handleCalculate() {
    if (!form.periodStart || !form.periodEnd || !form.netProfit) {
      toast.error("Semua field wajib diisi");
      return;
    }
    const profit = Number(form.netProfit);
    if (isNaN(profit) || profit <= 0) {
      toast.error("Laba bersih harus berupa angka positif");
      return;
    }

    setCalculating(true);
    try {
      const res = await fetch("/api/admin/investors/profit-shares/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          netProfit: profit,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const count = Array.isArray(data.data) ? data.data.length : 0;
        toast.success(`Bagi hasil berhasil dihitung untuk ${count} investor`);
        onSuccess();
      } else {
        toast.error(data.message || "Gagal menghitung bagi hasil");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <HiOutlineCalculator className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          Hitung Bagi Hasil
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Periode Dari
          </label>
          <input
            type="date"
            value={form.periodStart}
            onChange={(e) =>
              setForm((f) => ({ ...f, periodStart: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Periode Sampai
          </label>
          <input
            type="date"
            value={form.periodEnd}
            onChange={(e) =>
              setForm((f) => ({ ...f, periodEnd: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Laba Bersih (Rp)
          </label>
          <input
            type="number"
            value={form.netProfit}
            onChange={(e) =>
              setForm((f) => ({ ...f, netProfit: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="0"
            min="0"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
          <HiOutlineCalculator className="w-4 h-4" />
          {calculating ? "Menghitung..." : "Hitung Bagi Hasil"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfitSharesClient() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission("investors:manage");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProfitShareStatus | "ALL">(
    "ALL",
  );

  const {
    data: sharesData,
    isLoading,
    mutate: refetchShares,
  } = useApi<ProfitShare[]>("/api/admin/investors/profit-shares", {
    onError: () => toast.error("Gagal memuat data bagi hasil"),
  });

  const profitShares = sharesData ?? [];

  const filteredShares =
    statusFilter === "ALL"
      ? profitShares
      : profitShares.filter((s) => s.status === statusFilter);

  const totalApproved = profitShares
    .filter((s) => s.status === "APPROVED")
    .reduce((sum, s) => sum + s.shareAmount, 0);

  const totalPaid = profitShares
    .filter((s) => s.status === "PAID")
    .reduce((sum, s) => sum + s.shareAmount, 0);

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function handleApprove(shareId: string) {
    setActionLoading(shareId + "_approve");
    try {
      const res = await fetch(
        `/api/admin/investors/profit-shares/${shareId}/approve`,
        { method: "POST" },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Bagi hasil berhasil disetujui");
        void refetchShares();
      } else {
        toast.error(data.message || "Gagal menyetujui bagi hasil");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePay(shareId: string) {
    setActionLoading(shareId + "_pay");
    try {
      const res = await fetch(
        `/api/admin/investors/profit-shares/${shareId}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Bagi hasil berhasil ditandai sebagai dibayar");
        void refetchShares();
      } else {
        toast.error(data.message || "Gagal menandai pembayaran");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setActionLoading(null);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlineChartBarSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Bagi Hasil Investor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kalkulasi dan distribusi bagi hasil kepada investor
          </p>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-xl" />
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-indigo-200 text-sm font-medium mb-1">
              Total Menunggu Pembayaran
            </p>
            <p className="text-3xl font-black">
              {formatCurrency(totalApproved)}
            </p>
            <p className="text-indigo-200 text-sm mt-1">
              {profitShares.filter((s) => s.status === "APPROVED").length} bagi
              hasil disetujui
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-xl px-5 py-3 self-start">
            <HiOutlineBanknotes className="w-8 h-8 text-green-300" />
            <div>
              <p className="text-xl font-black">{formatCurrency(totalPaid)}</p>
              <p className="text-indigo-200 text-xs">Total Sudah Dibayar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calculate Form */}
      {canManage && (
        <CalculateForm
          onSuccess={() => {
            void refetchShares();
          }}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {(
          [
            {
              status: "CALCULATED",
              label: "Dihitung",
              color: "text-gray-600 dark:text-gray-400",
              bg: "bg-gray-50 dark:bg-gray-800/50",
            },
            {
              status: "APPROVED",
              label: "Disetujui",
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-50 dark:bg-blue-900/20",
            },
            {
              status: "PAID",
              label: "Dibayar",
              color: "text-green-600 dark:text-green-400",
              bg: "bg-green-50 dark:bg-green-900/20",
            },
          ] as const
        ).map((item) => (
          <div
            key={item.status}
            className={`${item.bg} rounded-2xl p-4 border border-gray-100 dark:border-gray-800`}
          >
            <p className={`text-2xl font-black ${item.color}`}>
              {profitShares.filter((s) => s.status === item.status).length}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "ALL", label: "Semua" },
            { value: "CALCULATED", label: "Dihitung" },
            { value: "APPROVED", label: "Disetujui" },
            { value: "PAID", label: "Dibayar" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              statusFilter === opt.value
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-white dark:bg-[#1e293b] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-indigo-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <PageLoader variant="section" message="Memuat data bagi hasil..." />
        ) : filteredShares.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <HiOutlineChartBarSquare className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Belum ada data bagi hasil
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Gunakan form di atas untuk menghitung bagi hasil
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Investor
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Periode
                  </th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Laba Bersih
                  </th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    %
                  </th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Jumlah Bagi Hasil
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  {canManage && (
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredShares.map((share) => (
                  <tr
                    key={share.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {share.investor?.namaLengkap ?? "—"}
                      </div>
                      {share.investor?.perusahaan && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {share.investor.perusahaan}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400 text-xs">
                      {formatPeriod(share.periodStart, share.periodEnd)}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-600 dark:text-gray-400">
                      {formatCurrency(share.netProfit)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {share.sharePercent}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-black text-gray-900 dark:text-white">
                        {formatCurrency(share.shareAmount)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={share.status} />
                    </td>
                    {canManage && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {share.status === "CALCULATED" && (
                            <button
                              onClick={() => handleApprove(share.id)}
                              disabled={actionLoading === share.id + "_approve"}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                            >
                              <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                              {actionLoading === share.id + "_approve"
                                ? "..."
                                : "Setujui"}
                            </button>
                          )}
                          {share.status === "APPROVED" && (
                            <button
                              onClick={() => handlePay(share.id)}
                              disabled={actionLoading === share.id + "_pay"}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                            >
                              <HiOutlineBanknotes className="w-3.5 h-3.5" />
                              {actionLoading === share.id + "_pay"
                                ? "..."
                                : "Tandai Dibayar"}
                            </button>
                          )}
                          {share.status === "PAID" && (
                            <span className="text-xs text-gray-400 italic">
                              Selesai
                            </span>
                          )}
                        </div>
                      </td>
                    )}
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
