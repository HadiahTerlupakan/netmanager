"use client";

import {
  HiOutlineArrowPath,
  HiOutlineClock,
  HiOutlineInformationCircle,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";

export default function KembaliBarangPlaceholder() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <HiOutlineArrowPath className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Kembali Barang</h1>
        </div>
        <p className="text-green-100">Form pengembalian barang ke gudang</p>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
            <HiOutlineClock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>

          {/* Content */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Fitur dalam Pengembangan
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
              Fitur pengembalian barang sedang dalam tahap pengembangan. Segera
              hadir untuk memudahkan proses pengembalian barang ke gudang.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
            <div className="flex items-start gap-3">
              <HiOutlineInformationCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-2">Yang akan hadir:</p>
                <ul className="space-y-1 text-blue-700 dark:text-blue-300">
                  <li>• Form pengembalian barang yang mudah digunakan</li>
                  <li>• Tracking status pengembalian real-time</li>
                  <li>• Validasi kondisi barang otomatis</li>
                  <li>• Dokumentasi foto untuk pengembalian</li>
                  <li>• Riwayat pengembalian barang</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button disabled variant="secondary" size="lg">
              Kembali Barang (Coming Soon)
            </Button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
          📌 Informasi Sementara
        </h3>
        <div className="space-y-2">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Untuk sementara, jika Anda perlu mengembalikan barang, silakan
            hubungi admin gudang secara langsung atau melalui sistem tiket.
          </p>
          <div className="border-t border-amber-200 dark:border-amber-700 pt-2 mt-2">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Alternatif:</strong> Gunakan form manual di kantor gudang
              atau hubungi ext. 123 untuk bantuan pengembalian barang.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
