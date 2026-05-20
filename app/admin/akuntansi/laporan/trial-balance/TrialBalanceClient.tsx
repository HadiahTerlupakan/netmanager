"use client";

import { useState } from "react";
import { HiOutlineChartBar } from "react-icons/hi2";
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
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/accounting/reports/trial-balance?asOfDate=${asOfDate}`,
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
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <HiOutlineChartBar className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          Trial Balance
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Neraca saldo per tanggal tertentu
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Per Tanggal
            </label>
            <input
              type="date"
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50"
          >
            {loading ? "Memuat..." : "Tampilkan"}
          </button>
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Kode
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nama Akun
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Debit
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Kredit
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                  <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                    {r.coaCode}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {r.coaName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      {r.coaType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(Number(r.totalDebit))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
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
                  className="px-4 py-3 font-bold text-gray-900 dark:text-white"
                >
                  TOTAL
                </td>
                <td className="px-4 py-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(Number(report.totalDebit))}
                </td>
                <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(Number(report.totalCredit))}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${report.balanced ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}
                  >
                    {report.balanced ? "✓ Balance" : "✗ Tidak Balance"}
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
