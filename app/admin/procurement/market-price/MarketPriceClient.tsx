"use client";

import { HiOutlineChartBar } from "react-icons/hi2";
import { ProcurementPageShell } from "../_components/ProcurementPageShell";

/**
 * Placeholder Referensi Harga Pasar.
 * Sebelum entitas MarketPrice di-model, halaman ini cukup tampilkan card
 * informatif supaya navigasi dari sidebar tidak menghasilkan 404.
 */
export function MarketPriceClient() {
  return (
    <ProcurementPageShell
      title="Referensi Harga Pasar"
      subtitle="Pantau harga referensi item untuk negosiasi & forecasting."
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-12 text-center">
        <HiOutlineChartBar className="w-12 h-12 mx-auto text-gray-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          Belum tersedia
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Modul referensi harga pasar masih dalam tahap perencanaan. Saat ini
          harga vendor disimpan langsung di Purchase Order. Hubungi tim
          development bila Anda ingin mempercepat pembangunan modul ini.
        </p>
      </div>
    </ProcurementPageShell>
  );
}
