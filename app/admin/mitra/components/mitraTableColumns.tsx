import {
  HiOutlineWrenchScrewdriver,
  HiOutlineMegaphone,
} from "react-icons/hi2";
import type { Column } from "@/components/ui/ResponsiveTable";
import { MitraTableActions } from "./MitraTableActions";
import type { Mitra } from "./types";
import { formatCurrency } from "./types";
import type { MitraActionHandlers } from "./MitraTableActions";

export const mitraColumns: Column<Mitra>[] = [
  {
    key: "name",
    header: "Mitra",
    priority: "primary",
    render: (mitra: Mitra) => (
      <div className="flex items-center gap-3">
        <div
          className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
            mitra.mitraType === "MITRA_TEKNISI"
              ? "bg-linear-to-br from-blue-500 to-cyan-600"
              : "bg-linear-to-br from-purple-500 to-pink-600"
          }`}
        >
          {mitra.mitraType === "MITRA_TEKNISI" ? (
            <HiOutlineWrenchScrewdriver className="w-5 h-5 text-white" />
          ) : (
            <HiOutlineMegaphone className="w-5 h-5 text-white" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {mitra.name || mitra.email.split("@")[0]}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {mitra.email}
            {mitra.requiresFaceVerification && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-xs font-medium dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Wajib Verif Wajah
              </span>
            )}
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "employeeType",
    header: "Tipe",
    priority: "primary",
    render: (mitra: Mitra) => (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
          mitra.mitraType === "MITRA_TEKNISI"
            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
        }`}
      >
        {mitra.mitraType === "MITRA_TEKNISI" ? "Teknisi" : "Sales"}
      </span>
    ),
  },
  {
    key: "phone",
    header: "Telepon",
    priority: "secondary",
    render: (mitra: Mitra) => (
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {mitra.phone || "-"}
      </span>
    ),
  },
  {
    key: "rate",
    header: "Rate Komisi",
    priority: "secondary",
    render: (mitra: Mitra) => (
      <div className="text-sm">
        {mitra.mitraType === "MITRA_TEKNISI" ? (
          <div className="flex flex-col gap-1 text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">PSB:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {formatCurrency(mitra.mitraRateWoPsb)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium whitespace-nowrap">
                MTc:
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {formatCurrency(mitra.mitraRateWoMaintenance)}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-purple-600 dark:text-purple-400 font-medium">
            Canvasing: {formatCurrency(mitra.mitraRateCanvasing)}
          </span>
        )}
      </div>
    ),
  },
  {
    key: "wallet",
    header: "Saldo",
    priority: "primary",
    render: (mitra: Mitra) => (
      <div className="text-sm font-medium text-green-600 dark:text-green-400">
        {formatCurrency(mitra.mitraWallet?.balance || 0)}
      </div>
    ),
  },
  {
    key: "isActive",
    header: "Status",
    priority: "primary",
    render: (mitra: Mitra) => (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          mitra.isActive
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        }`}
      >
        {mitra.isActive ? "Aktif" : "Nonaktif"}
      </span>
    ),
  },
];

export function renderMitraActions(
  mitra: Mitra,
  handlers: MitraActionHandlers,
) {
  return <MitraTableActions mitra={mitra} handlers={handlers} />;
}
