"use client";

import { useState, useRef, useEffect } from "react";
import { HiOutlineBookOpen } from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";

interface CoaOption {
  id: string;
  code: string;
  name: string;
}
interface Entry {
  date: string;
  entryNumber: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}
interface Report {
  coaCode: string;
  coaName: string;
  from: string;
  to: string;
  openingBalance: string;
  entries: Entry[];
  closingBalance: string;
}

export function BukuKasClient() {
  const [coaId, setCoaId] = useState("");
  const [from, setFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetch("/api/admin/accounting/coa?type=ASSET")
      .then((r) => r.json())
      .then((data) => setCoaOptions(data.data || []));
  }, []);

  const fetchReport = async () => {
    if (!coaId) return;
    setLoading(true);
    const res = await fetch(
      `/api/admin/accounting/reports/cash-book?coaId=${coaId}&from=${from}&to=${to}`,
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
            <HiOutlineBookOpen className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          Buku Kas & Bank
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Mutasi kas dan bank per akun untuk periode tertentu
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Akun
            </label>
            <select
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
              value={coaId}
              onChange={(e) => setCoaId(e.target.value)}
            >
              <option value="">Pilih akun...</option>
              {coaOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
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
            disabled={loading || !coaId}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50"
          >
            {loading ? "Memuat..." : "Tampilkan"}
          </button>
        </div>
      </div>

      {/* Report */}
      {report && (
        <>
          {/* Opening Balance */}
          <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
              Saldo Awal
            </span>
            <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
              {formatCurrency(Number(report.openingBalance))}
            </span>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    No. Jurnal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deskripsi
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
                {report.entries.map((e, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {e.date}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      {e.entryNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {e.description}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                      {Number(e.debit) > 0
                        ? formatCurrency(Number(e.debit))
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {Number(e.credit) > 0
                        ? formatCurrency(Number(e.credit))
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                      {formatCurrency(Number(e.runningBalance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Closing Balance */}
          <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
              Saldo Akhir
            </span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(Number(report.closingBalance))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
