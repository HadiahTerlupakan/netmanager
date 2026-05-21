"use client";

import { useState } from "react";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import toast from "react-hot-toast";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function ExportPajakClient() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [ppnYear, setPpnYear] = useState(currentYear);
  const [ppnMonth, setPpnMonth] = useState(currentMonth);
  const [pph21Year, setPph21Year] = useState(currentYear);
  const [pph21Month, setPph21Month] = useState(currentMonth);
  const [bhpYear, setBhpYear] = useState(currentYear);

  const handleDownload = (url: string) => {
    try {
      window.open(url, "_blank");
    } catch {
      toast.error("Gagal mengunduh file");
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlineArrowDownTray className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
          Export Laporan Pajak
        </h1>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PPN */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Rekap PPN
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Export rekap PPN Masukan & Keluaran per bulan
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={ppnYear}
              onChange={(e) => setPpnYear(Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-sm text-gray-700 dark:text-gray-200"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={ppnMonth}
              onChange={(e) => setPpnMonth(Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-sm text-gray-700 dark:text-gray-200"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() =>
              handleDownload(
                `/api/admin/tax/export/ppn?year=${ppnYear}&month=${ppnMonth}`,
              )
            }
            className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 flex items-center justify-center gap-2"
          >
            <HiOutlineArrowDownTray className="w-4 h-4" />
            Download CSV
          </button>
        </div>

        {/* PPh 21 */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Rekap PPh 21
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Export rekap PPh 21 karyawan per bulan
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={pph21Year}
              onChange={(e) => setPph21Year(Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-sm text-gray-700 dark:text-gray-200"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={pph21Month}
              onChange={(e) => setPph21Month(Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-sm text-gray-700 dark:text-gray-200"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() =>
              handleDownload(
                `/api/admin/tax/export/pph21?year=${pph21Year}&month=${pph21Month}`,
              )
            }
            className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 flex items-center justify-center gap-2"
          >
            <HiOutlineArrowDownTray className="w-4 h-4" />
            Download CSV
          </button>
        </div>

        {/* BHP/USO */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Rekap BHP & USO
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Export rekap BHP & USO per tahun
            </p>
          </div>
          <div>
            <select
              value={bhpYear}
              onChange={(e) => setBhpYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-sm text-gray-700 dark:text-gray-200"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() =>
              handleDownload(`/api/admin/tax/export/bhp-uso?year=${bhpYear}`)
            }
            className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 flex items-center justify-center gap-2"
          >
            <HiOutlineArrowDownTray className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
