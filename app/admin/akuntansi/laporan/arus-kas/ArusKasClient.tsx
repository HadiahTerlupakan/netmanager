"use client";

import { useState } from "react";
import { HiOutlineBanknotes } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
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
      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
        {section.label}
      </h3>
      {section.accounts.map((a) => (
        <div key={a.coaCode} className="flex justify-between pl-4 text-sm">
          <span className="text-gray-700 dark:text-gray-300">
            {a.coaCode} — {a.coaName}
          </span>
          <span className="font-mono text-gray-900 dark:text-white">
            {formatCurrency(Number(a.amount))}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2 font-bold text-sm text-gray-900 dark:text-white">
        <span>Subtotal</span>
        <span className="font-mono">
          {formatCurrency(Number(section.subtotal))}
        </span>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlineBanknotes className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Laporan Arus Kas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Aliran kas operasional, investasi, dan pendanaan
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

      {/* Report Content */}
      {report && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 max-w-2xl space-y-6">
          {renderSection(report.operating)}
          {renderSection(report.investing)}
          {renderSection(report.financing)}
          <div className="space-y-2 border-t-2 border-gray-200 dark:border-gray-600 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300">
                Perubahan Kas Bersih
              </span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">
                {formatCurrency(Number(report.netChange))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300">Kas Awal</span>
              <span className="font-mono text-gray-900 dark:text-white">
                {formatCurrency(Number(report.openingCash))}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
              <span className="font-black text-gray-900 dark:text-white">
                Kas Akhir
              </span>
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                {formatCurrency(Number(report.closingCash))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
