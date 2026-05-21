"use client";

import { useState } from "react";
import { HiOutlineChartPie } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { downloadCsv, downloadPdf } from "@/lib/utils/report-export";

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
  revenue: Section;
  expense: Section;
  netIncome: string;
}

export function LabaRugiClient() {
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
      `/api/admin/accounting/reports/profit-loss?from=${from}&to=${to}`,
    );
    if (res.ok) {
      const data = await res.json();
      setReport(data.data);
    }
    setLoading(false);
  };

  const csvHeaders = ["Kode", "Nama Akun", "Jumlah"];

  const getRows = (): string[][] => {
    if (!report) return [];
    const rows: string[][] = [];
    report.revenue.accounts.forEach((a) =>
      rows.push([a.coaCode, a.coaName, formatCurrency(Number(a.amount))]),
    );
    rows.push([
      "",
      `Subtotal ${report.revenue.label}`,
      formatCurrency(Number(report.revenue.subtotal)),
    ]);
    report.expense.accounts.forEach((a) =>
      rows.push([a.coaCode, a.coaName, formatCurrency(Number(a.amount))]),
    );
    rows.push([
      "",
      `Subtotal ${report.expense.label}`,
      formatCurrency(Number(report.expense.subtotal)),
    ]);
    rows.push([
      "",
      "Laba / Rugi Bersih",
      formatCurrency(Number(report.netIncome)),
    ]);
    return rows;
  };

  const handleDownloadCsv = () => {
    downloadCsv(`laba-rugi_${from}_${to}.csv`, csvHeaders, getRows());
  };

  const handleDownloadPdf = async () => {
    await downloadPdf(
      `laba-rugi_${from}_${to}.pdf`,
      "Laporan Laba Rugi",
      `Periode: ${from} s/d ${to}`,
      csvHeaders,
      getRows(),
    );
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
        <span>Subtotal {section.label}</span>
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
          <HiOutlineChartPie className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Laporan Laba Rugi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pendapatan dan beban dalam periode tertentu
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
        {report && (
          <div className="flex gap-2">
            <button
              onClick={handleDownloadCsv}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              Download Excel
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              Download PDF
            </button>
          </div>
        )}
      </div>

      {/* Report Content */}
      {report && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 max-w-2xl space-y-6">
          {renderSection(report.revenue)}
          {renderSection(report.expense)}
          <div className="flex justify-between border-t-2 border-gray-200 dark:border-gray-600 pt-4">
            <span className="text-base font-black text-gray-900 dark:text-white">
              Laba / Rugi Bersih
            </span>
            <span
              className={`text-base font-black font-mono ${
                Number(report.netIncome) >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(Number(report.netIncome))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
