"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineUser,
  HiOutlineCreditCard,
  HiOutlineClock,
  HiSignalSlash,
  HiArrowRight,
  HiArrowPath,
  HiOutlineInformationCircle,
} from 'react-icons/hi2'
import Link from 'next/link'
import { usePelanggan } from '@/hooks/usePelanggan'
import { ConnectionStatusCard } from '@/components/pelanggan/ConnectionStatusCard'
import { UsageStatsCard } from '@/components/pelanggan/UsageStatsCard'
import { SessionHistoryTable } from '@/components/pelanggan/SessionHistoryTable'
import { FullPageLoader } from '@/components/pelanggan/LoadingStates'

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
      <p className="text-sm font-semibold">
        {formatDateShort(pelangganJatuhTempo)}
      </p>
      {loading ? (
        <p className="text-xs text-white/70">Memuat...</p>
      ) : (
        nextJatuhTempo && (
          <p className="text-xs text-white/70 mt-1">
            Berikutnya: {formatDateShort(nextJatuhTempo)}
          </p>
        )
      )}
      {isOverdue() && (
        <p className="text-xs text-yellow-300 mt-1">
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

  // Data usage demo
  const [dataUsage] = useState({
    upload: { used: 2.5, total: 10, unit: 'GB' },
    download: { used: 8.7, total: 50, unit: 'GB' }
  })

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

  if (loading) {
    return <FullPageLoader message="Memuat dashboard..." />
  }

  if (!pelanggan) {
    return null
  }

  const isOverdue = isJatuhTempo(pelanggan.jatuhTempo)
  const uploadPercentage = (dataUsage.upload.used / dataUsage.upload.total) * 100
  const downloadPercentage = (dataUsage.download.used / dataUsage.download.total) * 100

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
        <div className="fixed top-0 left-0 right-0 z-50 bg-sky-500 text-white p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Install NetManager untuk akses lebih cepat</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowInstallPrompt(false)
                  localStorage.setItem('pwa-install-dismissed', 'true')
                }}
                className="px-3 py-1 text-sm hover:bg-sky-600 rounded transition-colors"
              >
                Nanti
              </button>
              <button
                onClick={handleInstall}
                className="px-4 py-1.5 text-sm font-medium bg-white text-sky-600 rounded hover:bg-gray-100 transition-colors"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Selamat datang kembali, {pelanggan.nama}!</p>
              </div>
              <button
                onClick={() => refresh()}
                disabled={loading || refreshing}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 relative"
                title="Refresh"
              >
                <HiArrowPath className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="px-4 py-6 md:px-6 lg:px-8 max-w-7xl mx-auto">
          {lastRefreshTime && (
            <div className="mb-4 text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Terakhir diperbarui: {lastRefreshTime.toLocaleTimeString('id-ID')}
              </span>
            </div>
          )}

          {/* Client Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/20 rounded-full flex items-center justify-center">
                  <HiOutlineUser className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Client</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{pelanggan.noTelp || pelanggan.idPelanggan}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">Saldo Tagihan</p>
                <SaldoTagihan pelangganId={pelanggan.id} />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
              <Link
                href="/pelanggan/tagihan"
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
              >
                <HiOutlineCreditCard className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Bayar</span>
              </Link>
              <Link
                href="/pelanggan/tagihan?tab=riwayat"
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <HiArrowRight className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Riwayat</span>
              </Link>
              <Link
                href="/pelanggan/bantuan"
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              >
                <HiOutlineInformationCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Bantuan</span>
              </Link>
            </div>
          </div>

          {/* Package Info Card */}
          <div className="bg-gradient-to-br from-sky-400 to-cyan-500 rounded-xl shadow-lg mb-6 p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm opacity-90">Paket Internet</p>
                <p className="text-xl font-bold">{pelanggan.hargaPaket?.name || 'Tidak ada paket'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">Status</p>
                <p className="text-lg font-bold">{pelanggan.status}</p>
              </div>
            </div>

            <p className="text-xs opacity-75 mb-4">* Data usage demo - Integrasi monitoring dalam pengembangan</p>

            {/* Data Usage */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 mb-2">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="white"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - uploadPercentage / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-bold">{dataUsage.upload.used}</span>
                  </div>
                </div>
                <p className="text-xs opacity-90">UPLOAD</p>
                <p className="text-xs opacity-75">{dataUsage.upload.unit}</p>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 mb-2">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="white"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - downloadPercentage / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-bold">{dataUsage.download.used}</span>
                  </div>
                </div>
                <p className="text-xs opacity-90">DOWNLOAD</p>
                <p className="text-xs opacity-75">{dataUsage.download.unit}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div>
                <p className="text-xs opacity-90">Kadaluarsa</p>
                <JatuhTempoDenganInfo
                  pelangganId={pelanggan.id}
                  pelangganJatuhTempo={pelanggan.jatuhTempo}
                />
              </div>
            </div>
          </div>

          {/* Alert Overdue */}
          {isOverdue && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <HiOutlineClock className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-400 mb-1">
                    ⚠️ Tagihan Anda sudah jatuh tempo
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500">
                    Silakan lakukan pembayaran untuk menghindari gangguan layanan
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* RADIUS Components */}
          <ConnectionStatusCard />
          <UsageStatsCard />
          <SessionHistoryTable />
        </main>
      </div>
    </>
  )
}
