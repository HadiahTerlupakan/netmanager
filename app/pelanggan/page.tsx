"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineUser,
  HiOutlineCreditCard,
  HiOutlineClock,
  HiSignalSlash,
  HiArrowRight,
  HiOutlineInformationCircle,
  HiBars3,
} from 'react-icons/hi2'
import Link from 'next/link'
import { usePelanggan } from '@/hooks/usePelanggan'
import dynamic from 'next/dynamic'

const ConnectionStatusCard = dynamic(() => import('@/components/pelanggan/ConnectionStatusCard').then(mod => ({ default: mod.ConnectionStatusCard })), {
  loading: () => <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-5 animate-pulse"><div className="h-5 md:h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3" /></div>
})

const UsageStatsCard = dynamic(() => import('@/components/pelanggan/UsageStatsCard').then(mod => ({ default: mod.UsageStatsCard })), {
  loading: () => <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-5 animate-pulse"><div className="h-5 md:h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-5" /></div>
})

const SessionHistoryTable = dynamic(() => import('@/components/pelanggan/SessionHistoryTable').then(mod => ({ default: mod.SessionHistoryTable })), {
  loading: () => <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-5 animate-pulse"><div className="h-5 md:h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-5" /></div>
})
import { FullPageLoader } from '@/components/pelanggan/LoadingStates'
import { PaymentReminderBanner } from '@/components/pelanggan/PaymentReminderBanner'
import PelangganHeader from '@/components/pelanggan/PelangganHeader'

// Helper function untuk format tanggal pendek
const formatDateShort = (dateString: string) => {
  const date = new Date(dateString)
  const day = date.getDate()
  const month = date.toLocaleDateString('id-ID', { month: 'short' })
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

// Komponen untuk menampilkan jatuh tempo dengan keterangan tagihan berikutnya
function JatuhTempoDenganInfo({ pelangganId, pelangganJatuhTempo }: {
  pelangganId: string;
  pelangganJatuhTempo: string
}) {
  const [nextJatuhTempo, setNextJatuhTempo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNextJatuhTempo = async () => {
      try {
        const token = localStorage.getItem('pelanggan_token')
        const response = await fetch(`/api/tagihan/pelanggan/${pelangganId}`, {
          cache: 'no-store',
          headers: {
            'x-pelanggan-token': token || '',
            'Cache-Control': 'no-cache',
          },
        })

        if (response.ok) {
          const tagihans = await response.json()
          const tagihanTerdekat = tagihans
            .filter((t: any) => t.status === 'BELUM_LUNAS')
            .sort((a: any, b: any) => new Date(a.jatuhTempo).getTime() - new Date(b.jatuhTempo).getTime())[0]

          if (tagihanTerdekat) {
            setNextJatuhTempo(tagihanTerdekat.jatuhTempo)
          }
        }
      } catch (error) {
        console.error('[JatuhTempoDenganInfo] Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNextJatuhTempo()
    const intervalId = setInterval(fetchNextJatuhTempo, 30000)
    return () => clearInterval(intervalId)
  }, [pelangganId])

  const isOverdue = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const jatuhTempoDate = new Date(pelangganJatuhTempo)
    return jatuhTempoDate < today
  }

  return (
    <div>
      <p className="text-xs md:text-sm font-semibold leading-tight">
        {formatDateShort(pelangganJatuhTempo)}
      </p>
      {loading ? (
        <p className="text-[10px] md:text-xs text-white/70 mt-0.5 leading-relaxed">Memuat...</p>
      ) : (
        nextJatuhTempo && (
          <p className="text-[10px] md:text-xs text-white/70 mt-1 leading-relaxed">
            Berikutnya: {formatDateShort(nextJatuhTempo)}
          </p>
        )
      )}
      {isOverdue() && (
        <p className="text-[10px] md:text-xs text-yellow-300 mt-1 leading-relaxed">
          ⚠️ Jatuh tempo terlewat
        </p>
      )}
    </div>
  )
}

// Komponen untuk menampilkan saldo tagihan
function SaldoTagihan({ pelangganId }: { pelangganId: string }) {
  const [saldo, setSaldo] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSaldo = async () => {
      try {
        const token = localStorage.getItem('pelanggan_token')
        const response = await fetch(`/api/tagihan/pelanggan/${pelangganId}`, {
          cache: 'no-store',
          headers: {
            'x-pelanggan-token': token || '',
            'Cache-Control': 'no-cache',
          },
        })

        if (response.ok) {
          const tagihans = await response.json()
          const totalBelumBayar = tagihans
            .filter((t: any) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT')
            .reduce((sum: number, t: any) => sum + t.total, 0)
          setSaldo(totalBelumBayar)
        }
      } catch (error) {
        console.error('[SaldoTagihan] Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSaldo()
    const intervalId = setInterval(fetchSaldo, 30000)
    const handleFocus = () => fetchSaldo()
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchSaldo()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pelangganId])

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return <p className="text-lg font-bold text-sky-600 dark:text-sky-400">...</p>
  }

  return (
    <p className="text-lg font-bold text-sky-600 dark:text-sky-400">
      {formatRupiah(saldo || 0)}
    </p>
  )
}

export default function PelangganDashboardPage() {
  const router = useRouter()
  const { data: pelanggan, loading, refreshing, lastRefreshTime, refresh } = usePelanggan()
  const [isOnline, setIsOnline] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [saldoTagihan, setSaldoTagihan] = useState(0)

  // Deteksi online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed) setShowInstallPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const isJatuhTempo = (jatuhTempo: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let jatuhTempoDate: Date
    if (jatuhTempo.includes('T')) {
      jatuhTempoDate = new Date(jatuhTempo)
    } else {
      const [year, month, day] = jatuhTempo.split('-').map(Number)
      jatuhTempoDate = new Date(year, month - 1, day)
    }
    jatuhTempoDate.setHours(0, 0, 0, 0)
    return jatuhTempoDate < today
  }

  // Auto-refresh data dashboard setiap 30 detik
  useEffect(() => {
    if (!pelanggan?.id) return

    const refreshData = async () => {
      // Refresh pelanggan data
      refresh()
      
      // Refresh saldo tagihan
      try {
        const token = localStorage.getItem('pelanggan_token')
        const response = await fetch(`/api/tagihan/pelanggan/${pelanggan.id}`, {
          cache: 'no-store',
          headers: { 'x-pelanggan-token': token || '' },
        })
        if (response.ok) {
          const tagihans = await response.json()
          const totalBelumBayar = tagihans
            .filter((t: any) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT')
            .reduce((sum: number, t: any) => sum + t.total, 0)
          setSaldoTagihan(totalBelumBayar)
        }
      } catch (error) {
        console.error('[refreshData] Error:', error)
      }
    }

    // Initial fetch
    const fetchSaldo = async () => {
      try {
        const token = localStorage.getItem('pelanggan_token')
        const response = await fetch(`/api/tagihan/pelanggan/${pelanggan.id}`, {
          cache: 'default',
          headers: { 'x-pelanggan-token': token || '' },
        })
        if (response.ok) {
          const tagihans = await response.json()
          const totalBelumBayar = tagihans
            .filter((t: any) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT')
            .reduce((sum: number, t: any) => sum + t.total, 0)
          setSaldoTagihan(totalBelumBayar)
        }
      } catch (error) {
        console.error('[fetchSaldo] Error:', error)
      }
    }

    fetchSaldo()
    
    // Auto-refresh every 30 seconds
    const intervalId = setInterval(refreshData, 30000)
    
    // Refresh when window gains focus
    const handleFocus = () => refreshData()
    window.addEventListener('focus', handleFocus)
    
    // Refresh when visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshData()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pelanggan?.id, refresh])

  if (loading) {
    return <FullPageLoader message="Memuat dashboard..." />
  }

  if (!pelanggan) {
    return null
  }

  const isOverdue = isJatuhTempo(pelanggan.jatuhTempo)

  return (
    <>
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white text-center py-2 px-4 text-sm flex items-center justify-center gap-2">
          <HiSignalSlash className="w-4 h-4" />
          <span>Anda sedang offline</span>
        </div>
      )}

      {/* PWA Install Prompt */}
      {showInstallPrompt && !window.matchMedia('(display-mode: standalone)').matches && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-3 md:px-6 md:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm md:text-base font-medium">Install NetManager untuk akses lebih cepat</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setShowInstallPrompt(false)
                    localStorage.setItem('pwa-install-dismissed', 'true')
                  }}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 active:scale-95"
                >
                  Nanti
                </button>
                <button
                  onClick={handleInstall}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold bg-white text-sky-600 rounded-lg hover:bg-gray-50 transition-all duration-200 active:scale-95"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <PelangganHeader 
          title="Dashboard" 
          subtitle={`Selamat datang kembali, ${pelanggan.nama}!`}
        />

        {/* Content */}
        <main className="px-4 py-4 md:px-6 md:py-6 lg:px-8 max-w-7xl mx-auto">
          {/* Payment Reminder Banner - Only show if overdue or urgent */}
          {saldoTagihan > 0 && (isOverdue || Math.ceil((new Date(pelanggan.jatuhTempo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 7) && (
            <div className="mb-6">
              <PaymentReminderBanner
                daysUntilDue={Math.max(0, Math.ceil((new Date(pelanggan.jatuhTempo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                amount={saldoTagihan}
                tagihanId="current"
                status={isOverdue ? 'TERLAMBAT' : 'BELUM_LUNAS'}
              />
            </div>
          )}

          {/* Profile & Quick Actions Section */}
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-5">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-sky-400 to-cyan-500 rounded-2xl flex items-center justify-center shrink-0">
                  <HiOutlineUser className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Pelanggan</p>
                  <p className="text-lg md:text-xl font-bold text-gray-900 dark:text-white truncate">{pelanggan.nama}</p>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">{pelanggan.noTelp || pelanggan.idPelanggan}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-3 md:gap-4">
                <Link
                  href="/pelanggan/tagihan"
                  className="flex flex-col items-center justify-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 hover:from-sky-100 hover:to-cyan-100 dark:hover:from-sky-900/30 dark:hover:to-cyan-900/30 transition-all duration-200 hover:shadow-md border border-sky-100 dark:border-sky-800 active:scale-95 min-h-[80px] md:min-h-[100px] touch-manipulation"
                >
                  <HiOutlineCreditCard className="w-5 h-5 md:w-6 md:h-6 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bayar</span>
                </Link>
                <Link
                  href="/pelanggan/tagihan?tab=riwayat"
                  className="flex flex-col items-center justify-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 transition-all duration-200 hover:shadow-md border border-blue-100 dark:border-blue-800 active:scale-95 min-h-[80px] md:min-h-[100px] touch-manipulation"
                >
                  <HiOutlineClock className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Riwayat</span>
                </Link>
                <Link
                  href="/pelanggan/bantuan"
                  className="flex flex-col items-center justify-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/30 dark:hover:to-amber-900/30 transition-all duration-200 hover:shadow-md border border-orange-100 dark:border-orange-800 active:scale-95 min-h-[80px] md:min-h-[100px] touch-manipulation"
                >
                  <HiOutlineInformationCircle className="w-5 h-5 md:w-6 md:h-6 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bantuan</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Package & Subscription Info Card */}
          <div className="mb-6">
            <div className="bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-500 rounded-2xl shadow-lg p-5 md:p-6 text-white overflow-hidden relative">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-16 -translate-x-16"></div>

              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
                  <div className="flex-1">
                    <p className="text-xs md:text-sm font-medium opacity-90 mb-1.5">Paket Internet</p>
                    <p className="text-xl md:text-2xl lg:text-3xl font-bold mb-1.5 leading-tight">{pelanggan.hargaPaket?.name || 'Tidak ada paket'}</p>
                    {pelanggan.hargaPaket?.harga && (
                      <p className="text-xs md:text-sm lg:text-base opacity-90 leading-relaxed">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(pelanggan.hargaPaket.harga)}/bulan
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <p className="text-xs md:text-sm font-medium opacity-90 mb-1.5">Status</p>
                    <span className={`inline-block px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold ${pelanggan.status === 'AKTIF'
                      ? 'bg-green-500/90 text-white'
                      : 'bg-red-500/90 text-white'
                      }`}>
                      {pelanggan.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-5 md:pt-6 border-t border-white/20">
                  <div>
                    <p className="text-xs md:text-sm font-medium opacity-90 mb-1.5">Berlaku Sampai</p>
                    <JatuhTempoDenganInfo
                      pelangganId={pelanggan.id}
                      pelangganJatuhTempo={pelanggan.jatuhTempo}
                    />
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs md:text-sm font-medium opacity-90 mb-1.5">ID Pelanggan</p>
                    <p className="text-sm md:text-base lg:text-lg font-semibold leading-tight">{pelanggan.idPelanggan}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Connection & Usage Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
            <ConnectionStatusCard />
            <UsageStatsCard />
          </div>

          {/* Session History Section */}
          <div className="mb-6">
            <SessionHistoryTable />
          </div>
        </main>
      </div>
    </>
  )
}
