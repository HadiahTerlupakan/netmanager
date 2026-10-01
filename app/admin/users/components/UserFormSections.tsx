"use client";

import { HiOutlineShieldCheck } from "react-icons/hi2";

import type { KepalaSalesTersimpan } from "../lib/kepalaSales";
import { KepalaSalesField } from "./KepalaSalesField";

/**
 * Skema target canvassing yang bermakna bagi logika pencairan
 * (`modules/marketing/config/marketing-points.ts` `ACCUMULATED_TARGET_SCHEMA`):
 * akumulasi = dicairkan sendiri dari aplikasi; selain itu bulanan.
 */
const OPSI_SKEMA_TARGET = [
  { nilai: "MONTHLY_RESET", label: "Bulanan (dicairkan otomatis di akhir bulan)" },
  { nilai: "ACCUMULATED", label: "Akumulasi (dicairkan sendiri dari aplikasi)" },
] as const;

export { OrganizationSection } from "@/app/admin/hr/_components/OrganizationSection";

interface StatusAndSalesSectionProps {
  formData: {
    isActive: boolean;
    canvasingTarget: number;
    targetSchema: string;
    kepalaSalesId: string;
  };
  /** Turunan persona role terpilih (`isSalesDariPersona`), bukan saklar manual. */
  isSales: boolean;
  /** Id user yang sedang diubah; null pada form tambah user. */
  userIdDiubah: string | null;
  /** Kepala sales yang tersimpan pada user yang diubah. */
  kepalaSalesTersimpan: KepalaSalesTersimpan | null;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
}

/**
 * Section Akses & Privilege: status aktif + target sales & canvassing.
 * Bagian sales tampil hanya bila role terpilih ber-persona Sales.
 */
export function StatusAndSalesSection({
  formData,
  isSales,
  handleChange,
  userIdDiubah,
  kepalaSalesTersimpan,
}: StatusAndSalesSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <HiOutlineShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Akses & Privilege
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pengaturan status dan fitur khusus pengguna
            </p>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              Akun Aktif
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pengguna dapat login ke sistem jika akun aktif
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="md:col-span-2 text-sm text-gray-500 dark:text-gray-400">
              Target canvassing berlaku untuk siapa pun yang ikut canvasing
              (sales, atau teknisi yang role-nya diberi izin canvasing).
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Canvassing (Poin)
              </label>
              <input
                type="number"
                name="canvasingTarget"
                value={formData.canvasingTarget}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skema Target
              </label>
              <select
                name="targetSchema"
                value={formData.targetSchema}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {OPSI_SKEMA_TARGET.map((opsi) => (
                  <option key={opsi.nilai} value={opsi.nilai}>
                    {opsi.label}
                  </option>
                ))}
              </select>
            </div>
            {isSales ? (
              <KepalaSalesField
                value={formData.kepalaSalesId}
                handleChange={handleChange}
                userIdDiubah={userIdDiubah}
                tersimpan={kepalaSalesTersimpan}
              />
            ) : (
              <p className="md:col-span-2 text-xs text-gray-500 dark:text-gray-400">
                Kepala sales hanya untuk pengguna dengan role ber-tampilan Sales
                (diatur di Hak Akses).
              </p>
            )}
          </div>
      </div>
    </div>
  );
}
