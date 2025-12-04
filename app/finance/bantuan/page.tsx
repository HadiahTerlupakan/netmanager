"use client"

import { useFinance } from '@/hooks/useFinance'
import { HiBars3, HiOutlineInformationCircle } from 'react-icons/hi2'

export default function FinanceBantuanPage() {
  const { data: financeUser, loading } = useFinance()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400">Memuat data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg md:ml-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if ((window as any).toggleFinanceSidebar) {
                    ; (window as any).toggleFinanceSidebar()
                  }
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation md:hidden"
                aria-label="Open menu"
              >
                <HiBars3 className="w-6 h-6" />
              </button>
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <HiOutlineInformationCircle className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold">Bantuan</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Bantuan & Dukungan</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Cara Menggunakan Portal Finance</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Portal Finance memungkinkan Anda untuk mengelola tagihan dan memantau status pembayaran pelanggan.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Kontak Dukungan</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Jika Anda memerlukan bantuan, silakan hubungi administrator sistem.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}




