"use client";

import { useState } from "react";
import { HiOutlineScale } from "react-icons/hi2";
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

  const csvHeaders = ["Kode", "Nama Akun", "Jumlah"];

  const getRows = (): string[][] => {
    if (!report) return [];
    const rows: string[][] = [];
    report.asset.accounts.forEach((a) =>
      rows.push([a.coaCode, a.coaName, formatCurrency(Number(a.amount))]),
    );
    rows.push([
      "",
      `Total ${report.asset.label}`,
      formatCurrency(Number(report.asset.subtotal)),
    ]);
    report.liability.accounts.forEach((a) =>
      rows.push([a.coaCode, a.coaName, formatCurrency(Number(a.amount))]),
    );
    rows.push([
      "",
      `Total ${report.liability.label}`,
      formatCurrency(Number(report.liability.subtotal)),
    ]);
    report.equity.accounts.forEach((a) =>
      rows.push([a.coaCode, a.coaName, formatCurrency(Number(a.amount))]),
    );
    rows.push([
      "",
      `Total ${report.equity.label}`,
      formatCurrency(Number(report.equity.subtotal)),
    ]);
    rows.push(["", "Total Aset", formatCurrency(Number(report.totalAsset))]);
    rows.push([
      "",
      "Total Liabilitas + Ekuitas",
      formatCurrency(Number(report.totalLiabilityEquity)),
    ]);
    return rows;
  };

  const handleDownloadCsv = () => {
    downloadCsv(`neraca_${asOfDate}.csv`, csvHeaders, getRows());
  };

  const handleDownloadPdf = async () => {
    await downloadPdf(
      `neraca_${asOfDate}.pdf`,
      "Neraca",
      `Per tanggal: ${asOfDate}`,
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
        <span>Total {section.label}</span>
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
          <HiOutlineScale className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Neraca
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Posisi keuangan aset, liabilitas, dan ekuitas
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
            Per Tanggal
          </label>
          <input
            type="date"
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
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
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">{renderSection(report.asset)}</div>
            <div className="space-y-6">
              {renderSection(report.liability)}
              {renderSection(report.equity)}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-gray-200 dark:border-gray-600 pt-4">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              Total Aset:{" "}
              <span className="font-mono">
                {formatCurrency(Number(report.totalAsset))}
              </span>
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              Total Liabilitas + Ekuitas:{" "}
              <span className="font-mono">
                {formatCurrency(Number(report.totalLiabilityEquity))}
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                report.balanced
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              }`}
            >
              {report.balanced ? "Seimbang" : "Tidak Seimbang"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
