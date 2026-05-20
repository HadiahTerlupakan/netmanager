"use client";

import { useState } from "react";
import { HiOutlineBanknotes } from "react-icons/hi2";
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
  from: string;
  to: string;
  operating: Section;
  investing: Section;
  financing: Section;
  netChange: string;
  openingCash: string;
  closingCash: string;
}

export function ArusKasClient() {
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
      `/api/admin/accounting/reports/cash-flow?from=${from}&to=${to}`,
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
        <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
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
            <HiOutlineBanknotes className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          Laporan Arus Kas
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Cash Flow Statement — operasional, investasi, dan pendanaan
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Dari
            </label>
            <input
              type="date"
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Sampai
            </label>
            <input
              type="date"
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
              value={to}
              onChange={(e) => setTo(e.target.value)}
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
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm max-w-2xl space-y-6">
          {renderSection(report.operating)}
          {renderSection(report.investing)}
          {renderSection(report.financing)}
          <div className="space-y-2 border-t-2 border-gray-300 dark:border-gray-600 pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                Perubahan Kas Bersih
              </span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">
                {formatCurrency(Number(report.netChange))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">Kas Awal</span>
              <span className="font-mono text-gray-700 dark:text-gray-300">
                {formatCurrency(Number(report.openingCash))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-black text-gray-900 dark:text-white">
                Kas Akhir
              </span>
              <span className="font-black font-mono text-indigo-600 dark:text-indigo-400">
                {formatCurrency(Number(report.closingCash))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
