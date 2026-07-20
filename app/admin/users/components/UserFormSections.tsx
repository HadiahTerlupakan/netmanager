"use client";

import { HiOutlineShieldCheck } from "react-icons/hi2";

export { OrganizationSection } from "@/app/admin/hr/_components/OrganizationSection";

interface StatusAndSalesSectionProps {
  formData: {
    isActive: boolean;
    isSales: boolean;
    canvasingTarget: number;
    targetSchema: string;
  };
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
}

/** Section Akses & Privilege: status aktif + fitur sales & canvassing. */
export function StatusAndSalesSection({
  formData,
  handleChange,
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

        <div className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
          <div>
            <h3 className="font-medium text-indigo-900 dark:text-indigo-300">
              Fitur Sales & Canvassing
            </h3>
            <p className="text-sm text-indigo-600/70 dark:text-indigo-400/60">
              Aktifkan jika user adalah Sales atau Teknisi yang merangkap Sales.
              User akan tampil di Manajemen Sales dan bisa akses menu
              Canvassing.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="isSales"
              checked={formData.isSales}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {formData.isSales && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
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
                <option value="REVENUE">Revenue (Pendapatan)</option>
                <option value="QUANTITY">Quantity (Jumlah Unit)</option>
                <option value="POINTS">Points (Poin Kinerja)</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
