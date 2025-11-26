"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiArrowPath,
  HiBars3,
  HiOutlineBanknotes,
  HiOutlineArrowDownCircle,
  HiOutlineArrowUpCircle,
} from 'react-icons/hi2'
import { useFinance } from '@/hooks/useFinance'

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

const getNamaBulan = (bulan: number) => {
  const bulanNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  return bulanNames[bulan - 1]
}

export default function FinanceCashflowPage() {
  const router = useRouter()
  const { data: financeUser, loading, refreshing, refresh } = useFinance()
  const [cashflowData, setCashflowData] = useState<any>(null)
  const [cashflowLoading, setCashflowLoading] = useState(true)

  useEffect(() => {
    const fetchCashflow = async () => {
      try {
        const token = localStorage.getItem('finance_token')
        if (!token) return

        const response = await fetch('/api/finance/cashflow', {
          headers: {
            'x-finance-token': token,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setCashflowData(data)
        }
      } catch (error) {
        console.error('Error fetching cashflow:', error)
      } finally {
        setCashflowLoading(false)
      }
    }

    if (financeUser) {
      fetchCashflow()
      // Auto-refresh setiap 30 detik
      const interval = setInterval(fetchCashflow, 30000)
      return () => clearInterval(interval)
    }
  }, [financeUser])

  const handleRefresh = () => {
    refresh()
    setCashflowLoading(true)
    const token = localStorage.getItem('finance_token')
    if (token) {
      fetch('/api/finance/cashflow', {
        headers: { 'x-finance-token': token },
      })
        .then(res => res.json())
        .then(data => {
          setCashflowData(data)
          setCashflowLoading(false)
        })
        .catch(err => {
          console.error('Error refreshing cashflow:', err)
          setCashflowLoading(false)
        })
    }
  }

  if (loading || cashflowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <HiArrowPath className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-4" />
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
                <HiOutlineBanknotes className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold">Cashflow</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing || cashflowLoading}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation disabled:opacity-50"
              title="Refresh"
            >
              <HiArrowPath className={`w-6 h-6 ${loading || refreshing || cashflowLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Pemasukan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Total Pemasukan
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {cashflowData ? formatRupiah(cashflowData.summary.totalPemasukan) : formatRupiah(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Dari tagihan yang sudah lunas
                </p>
              </div>
              <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <HiOutlineArrowDownCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          {/* Pengeluaran */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Total Pengeluaran
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {cashflowData ? formatRupiah(cashflowData.summary.totalPengeluaran) : formatRupiah(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Belum ada data pengeluaran
                </p>
              </div>
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <HiOutlineArrowUpCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Saldo */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Saldo
                </p>
                <p className={`text-2xl font-bold ${cashflowData && cashflowData.summary.saldo >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                  {cashflowData ? formatRupiah(cashflowData.summary.saldo) : formatRupiah(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Pemasukan - Pengeluaran
                </p>
              </div>
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <HiOutlineBanknotes className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Cashflow per Bulan */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cashflow per Bulan</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Rincian pemasukan dan pengeluaran per bulan
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Periode
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pemasukan
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pengeluaran
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status Tagihan
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {!cashflowData || cashflowData.perBulan.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      Belum ada data cashflow
                    </td>
                  </tr>
                ) : (
                  cashflowData.perBulan.map((item: any) => {
                    const saldoBulan = item.pemasukan - item.pengeluaran
                    return (
                      <tr key={`${item.tahun}-${item.bulan}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {getNamaBulan(item.bulan)} {item.tahun}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-green-600 dark:text-green-400">
                            {formatRupiah(item.pemasukan)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-red-600 dark:text-red-400">
                            {formatRupiah(item.pengeluaran)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className={`text-sm font-bold ${saldoBulan >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatRupiah(saldoBulan)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              {item.tagihanLunas} Lunas
                            </span>
                            {item.tagihanBelumLunas > 0 && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                                {item.tagihanBelumLunas} Belum Lunas
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

