"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineDocumentText,
  HiOutlineCurrencyDollar,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineUserGroup,
  HiOutlineChartBar,
  HiArrowPath,
  HiBars3,
} from 'react-icons/hi2'
import Link from 'next/link'
import { useFinance } from '@/hooks/useFinance'
import PageLoader from '@/components/ui/PageLoader'

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function FinanceDashboardPage() {
  const router = useRouter()
  const { data: financeUser, loading, refreshing, lastRefreshTime, refresh } = useFinance()
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('finance_token')
        if (!token) return

        const response = await fetch('/api/finance/stats', {
          headers: {
            'x-finance-token': token,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setStatsLoading(false)
      }
    }

    if (financeUser) {
      fetchStats()
      // Auto-refresh setiap 30 detik
      const interval = setInterval(fetchStats, 30000)
      return () => clearInterval(interval)
    }
  }, [financeUser])

  if (loading || statsLoading) {
    return <PageLoader />
  }

  if (!financeUser) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg md:ml-0 safe-area-inset-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <button
                onClick={() => {
                  if ((window as any).toggleFinanceSidebar) {
                    ; (window as any).toggleFinanceSidebar()
                  }
                }}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors md:hidden flex-shrink-0"
                aria-label="Open menu"
              >
                <HiBars3 className="w-6 h-6" />
              </button>
              <div className="w-9 h-9 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <HiOutlineCurrencyDollar className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h1 className="text-lg md:text-xl font-bold truncate">Finance Dashboard</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  refresh()
                  const token = localStorage.getItem('finance_token')
                  if (token) {
                    fetch('/api/finance/stats', {
                      headers: { 'x-finance-token': token },
                    })
                      .then(res => res.json())
                      .then(data => setStats(data))
                      .catch(err => console.error('Error refreshing stats:', err))
                  }
                }}
                disabled={loading || refreshing}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors disabled:opacity-50 relative"
                title="Refresh"
              >
                <HiArrowPath className={`w-6 h-6 ${loading || refreshing ? 'animate-spin' : ''}`} />
                {refreshing && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        {lastRefreshTime && (
          <div className="mb-2 text-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Terakhir diperbarui: {lastRefreshTime.toLocaleTimeString('id-ID')}
            </span>
          </div>
        )}

        {/* Welcome Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-md mb-3 md:mb-4 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Selamat Datang</p>
              <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                {financeUser.name || financeUser.email}
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center flex-shrink-0">
              <HiOutlineUserGroup className="w-5 h-5 md:w-6 md:h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          {/* Total Tagihan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Total Tagihan
                </p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.overview?.totalTagihan || 0}
                </p>
              </div>
              <div className="p-2 md:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0 ml-2">
                <HiOutlineDocumentText className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* Belum Lunas */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Belum Lunas
                </p>
                <p className="text-xl md:text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats?.overview?.belumLunas || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                  {formatRupiah(stats?.financial?.totalBelumLunas || 0)}
                </p>
              </div>
              <div className="p-2 md:p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex-shrink-0 ml-2">
                <HiOutlineClock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          {/* Terlambat */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Terlambat
                </p>
                <p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400">
                  {stats?.overview?.terlambat || 0}
                </p>
              </div>
              <div className="p-2 md:p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg flex-shrink-0 ml-2">
                <HiOutlineClock className="w-5 h-5 md:w-6 md:h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Lunas */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Lunas
                </p>
                <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats?.overview?.lunas || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                  {formatRupiah(stats?.financial?.totalLunas || 0)}
                </p>
              </div>
              <div className="p-2 md:p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg flex-shrink-0 ml-2">
                <HiOutlineCheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl md:rounded-2xl shadow-lg mb-3 md:mb-4 p-4 md:p-5 text-white">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h3 className="text-base md:text-lg font-semibold">Ringkasan Keuangan Bulan Ini</h3>
            <HiOutlineChartBar className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div>
              <p className="text-xs text-white/80 mb-1">Total Tagihan</p>
              <p className="text-xl md:text-2xl font-bold break-words">{formatRupiah(stats?.financial?.totalBulanIni || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-white/80 mb-1">Sudah Lunas</p>
              <p className="text-xl md:text-2xl font-bold">{stats?.financial?.lunasBulanIni || 0} tagihan</p>
            </div>
            <div>
              <p className="text-xs text-white/80 mb-1">Belum Lunas</p>
              <p className="text-xl md:text-2xl font-bold">{stats?.financial?.belumLunasBulanIni || 0} tagihan</p>
            </div>
          </div>
        </div>

        {/* Pelanggan Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Total Pelanggan
                </p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.pelanggan?.total || 0}
                </p>
              </div>
              <div className="p-2 md:p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex-shrink-0 ml-2">
                <HiOutlineUserGroup className="w-5 h-5 md:w-6 md:h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Pelanggan Aktif
                </p>
                <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats?.pelanggan?.aktif || 0}
                </p>
              </div>
              <div className="p-2 md:p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg flex-shrink-0 ml-2">
                <HiOutlineCheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 md:p-5">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3 md:mb-4">Aksi Cepat</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link
              href="/finance/tagihan"
              className="touch-target touch-manipulation flex items-center gap-3 p-3 md:p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors"
            >
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg flex-shrink-0">
                <HiOutlineDocumentText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm md:text-base text-gray-900 dark:text-white">Kelola Tagihan</p>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Lihat dan kelola semua tagihan</p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}




