'use client'

import { MarketPriceCheck } from '@/components/procurement/MarketPriceCheck'
import { HiOutlinePresentationChartBar } from 'react-icons/hi2'

export default function MarketPricePage() {
    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                            <HiOutlinePresentationChartBar className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Analisa Harga Pasar
                        </h1>
                    </div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400 pl-1">
                        Cek dan bandingkan harga aset & barang secara real-time dari Marketplace.
                    </p>
                </div>
            </div>

            <div className="w-full">
                <MarketPriceCheck />
            </div>
        </div>
    )
}
