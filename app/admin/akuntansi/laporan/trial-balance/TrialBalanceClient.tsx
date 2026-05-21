"use client";

import { useState } from "react";
import { HiOutlineChartBar } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

interface TrialBalanceRow {
  coaCode: string;
  coaName: string;
  coaType: string;
  totalDebit: string;
  totalCredit: string;
  balance: string;
}

interface Report {
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

export function TrialBalanceClient() {
  const [from, setFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/accounting/reports/trial-balance?from=${from}&to=${to}`,
    );
    if (res.ok) {
      const data = await res.json();
      setReport(data.data);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlineChartBar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Neraca Saldo
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ringkasan saldo debit dan kredit seluruh akun
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
            Dari
          </label>
          <input
            type="date"
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
            Sampai
          </label>
          <input
            type="date"
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button
          onClick={fetchReport}
          disabled={loading}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95"
        >
          {loading ? "Memuat..." : "Tampilkan"}
        </Button>
      </div>

      {/* Table */}
      {report && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Kode
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Nama Akun
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Tipe
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                  Debit
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                  Kredit
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {report.rows.map((r) => (
                <tr
                  key={r.coaCode}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                    {r.coaCode}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {r.coaName}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {r.coaType}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                    {formatCurrency(Number(r.totalDebit))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                    {formatCurrency(Number(r.totalCredit))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                    {formatCurrency(Number(r.balance))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50">
                <td
                  colSpan={3}
                  className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Total
                </td>
                <td className="px-4 py-3 text-right font-mono font-black text-gray-900 dark:text-white">
                  {formatCurrency(Number(report.totalDebit))}
                </td>
                <td className="px-4 py-3 text-right font-mono font-black text-gray-900 dark:text-white">
                  {formatCurrency(Number(report.totalCredit))}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      report.balanced
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {report.balanced ? "Seimbang" : "Tidak Seimbang"}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
