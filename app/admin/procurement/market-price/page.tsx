'use client'

import { MarketPriceCheck } from '@/components/procurement/MarketPriceCheck'
import { HiOutlinePresentationChartBar } from 'react-icons/hi2'

export default function MarketPricePage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlinePresentationChartBar className="w-8 h-8 text-indigo-600" />
                        Analisa Harga Pasar
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Alat bantu untuk mencari referensi dan membandingkan harga pasar barang (Tokopedia).
                        Gunakan data ini sebagai acuan estimasi harga dalam pengajuan Purchase Request (PR).
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Main Search Component */}
                <div className="w-full">
                    <MarketPriceCheck />
                </div>

                {/* Information Card */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-6">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                        Panduan Penggunaan
                    </h3>
                    <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-400 space-y-1">
                        <li>Masukkan kata kunci nama barang yang spesifik (contoh: "Modem Huawei HG8245H5").</li>
                        <li>Sistem akan mencari data real-time dari Tokopedia.</li>
                        <li>Gunakan informasi <strong>Harga Terendah</strong> dan <strong>Rata-Rata</strong> sebagai acuan negosiasi atau estimasi budget.</li>
                        <li>Klik icon panah kecil untuk melihat detail produk langsung di halaman Tokopedia.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
