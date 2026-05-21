"use client";

import { useRouter } from "next/navigation";
import {
  HiOutlineChartBar,
  HiOutlineChartPie,
  HiOutlineScale,
  HiOutlineBanknotes,
  HiOutlineBookOpen,
} from "react-icons/hi2";

const REPORTS = [
  {
    key: "trial-balance",
    label: "Neraca Saldo",
    description: "Ringkasan saldo debit dan kredit seluruh akun",
    icon: HiOutlineChartBar,
    path: "/admin/akuntansi/laporan/trial-balance",
  },
  {
    key: "laba-rugi",
    label: "Laba Rugi",
    description: "Pendapatan dan beban dalam periode tertentu",
    icon: HiOutlineChartPie,
    path: "/admin/akuntansi/laporan/laba-rugi",
  },
  {
    key: "neraca",
    label: "Neraca",
    description: "Posisi keuangan per tanggal tertentu",
    icon: HiOutlineScale,
    path: "/admin/akuntansi/laporan/neraca",
  },
  {
    key: "arus-kas",
    label: "Arus Kas",
    description: "Aliran kas operasional, investasi, dan pendanaan",
    icon: HiOutlineBanknotes,
    path: "/admin/akuntansi/laporan/arus-kas",
  },
  {
    key: "buku-kas",
    label: "Buku Kas & Bank",
    description: "Mutasi kas dan bank per akun",
    icon: HiOutlineBookOpen,
    path: "/admin/akuntansi/laporan/buku-kas",
  },
  {
    key: "buku-besar",
    label: "Buku Besar",
    description: "Detail mutasi per akun (General Ledger)",
    icon: HiOutlineBookOpen,
    path: "/admin/akuntansi/laporan/buku-besar",
  },
];

export function LaporanIndexClient() {
  const router = useRouter();

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlineChartPie className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Laporan Keuangan
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pilih jenis laporan yang ingin ditampilkan
          </p>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.key}
              onClick={() => router.push(report.path)}
              className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
                  <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {report.label}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {report.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
