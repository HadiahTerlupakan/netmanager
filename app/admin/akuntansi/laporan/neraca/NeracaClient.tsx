"use client";

import { useState } from "react";
import { HiOutlineScale } from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";

interface Account {
  coaCode: string;
  coaName: string;
  amount: string;
}
interface Section {
  label: string;
  accounts: Account[];
  subtotal: string;
}
interface Report {
  asOfDate: string;
  asset: Section;
  liability: Section;
  equity: Section;
  totalAsset: string;
  totalLiabilityEquity: string;
  balanced: boolean;
}

export function NeracaClient() {
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/accounting/reports/balance-sheet?asOfDate=${asOfDate}`,
    );
    if (res.ok) {
      const data = await res.json();
      setReport(data.data);
    }
    setLoading(false);
  };

  const renderSection = (section: Section) => (
    <div className="space-y-2">
      <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">
        {section.label}
      </h3>
      <div className="space-y-1">
        {section.accounts.map((a) => (
          <div key={a.coaCode} className="flex justify-between pl-4 text-sm">
            <span className="text-gray-700 dark:text-gray-300">
              <span className="font-mono text-gray-500 dark:text-gray-400">
                {a.coaCode}
              </span>{" "}
              — {a.coaName}
            </span>
            <span className="font-mono font-medium text-gray-900 dark:text-white">
              {formatCurrency(Number(a.amount))}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-bold text-sm">
        <span className="text-gray-700 dark:text-gray-300">
          Total {section.label}
        </span>
        <span className="font-mono text-gray-900 dark:text-white">
          {formatCurrency(Number(section.subtotal))}
        </span>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <HiOutlineScale className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          Neraca (Balance Sheet)
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Posisi keuangan per tanggal tertentu
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSection(report.asset)}
            <div className="flex justify-between border-t-2 border-gray-300 dark:border-gray-600 pt-3">
              <span className="font-black text-gray-900 dark:text-white">
                Total Aset
              </span>
              <span className="font-black font-mono text-indigo-600 dark:text-indigo-400">
                {formatCurrency(Number(report.totalAsset))}
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            {renderSection(report.liability)}
            {renderSection(report.equity)}
            <div className="flex justify-between border-t-2 border-gray-300 dark:border-gray-600 pt-3">
              <span className="font-black text-gray-900 dark:text-white">
                Total L+E
              </span>
              <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(Number(report.totalLiabilityEquity))}
              </span>
            </div>
          </div>
          <div className="md:col-span-2 bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center">
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${report.balanced ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}
            >
              {report.balanced
                ? "✓ Balance — Aset = Liabilitas + Ekuitas"
                : "✗ Tidak Balance"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
