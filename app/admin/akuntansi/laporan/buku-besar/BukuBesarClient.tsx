"use client";

import { useState, useRef, useEffect } from "react";
import { HiOutlineBookOpen } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
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
  coaType: string;
  normalSide: string;
  from: string;
  to: string;
  openingBalance: string;
  entries: Entry[];
  closingBalance: string;
}

export function BukuBesarClient() {
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
    fetch("/api/admin/accounting/coa?isActive=true")
      .then((r) => r.json())
      .then((data) => setCoaOptions(data.data || []));
  }, []);

  const fetchReport = async () => {
    if (!coaId) return;
    setLoading(true);
    const res = await fetch(
      `/api/admin/accounting/reports/general-ledger?coaId=${coaId}&from=${from}&to=${to}`,
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
          <HiOutlineBookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Buku Besar
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Riwayat transaksi lengkap per akun
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
            Akun
          </label>
          <select
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
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
          disabled={loading || !coaId}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95"
        >
          {loading ? "Memuat..." : "Tampilkan"}
        </Button>
      </div>

      {/* Report */}
      {report && (
        <>
          <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm inline-flex flex-wrap gap-8">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Akun
              </p>
              <p className="font-bold text-gray-900 dark:text-white">
                {report.coaCode} — {report.coaName}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Tipe
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                {report.coaType} · Normal: {report.normalSide}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Saldo Awal
              </p>
              <p className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                {formatCurrency(Number(report.openingBalance))}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                    No. Jurnal
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                    Deskripsi
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
                {report.entries.map((e, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {e.date}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                      {e.entryNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {e.description}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                      {Number(e.debit) > 0
                        ? formatCurrency(Number(e.debit))
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
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
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50">
                  <td
                    colSpan={5}
                    className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Saldo Akhir
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(Number(report.closingBalance))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
