"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiArrowRightOnRectangle,
  HiOutlineUser,
  HiOutlineCalendar,
  HiOutlineCreditCard,
  HiOutlineClock,
  HiOutlineHome,
  HiOutlineInformationCircle,
  HiSignalSlash,
  HiOutlineDocumentText,
  HiArrowRight,
  HiArrowPath,
  HiBell,
  HiArrowUpTray,
  HiArrowDownTray,
  HiWifi,
  HiPlus,
  HiTicket,
  HiUserGroup,
  HiBars3,
} from 'react-icons/hi2'
import Link from 'next/link'
import { usePelanggan } from '@/hooks/usePelanggan'
import { ConnectionStatusCard } from '@/components/pelanggan/ConnectionStatusCard'
import { UsageStatsCard } from '@/components/pelanggan/UsageStatsCard'
import { SessionHistoryTable } from '@/components/pelanggan/SessionHistoryTable'



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

          // Cari tagihan yang belum lunas dengan jatuh tempo terdekat
          const tagihanTerdekat = tagihans
            .filter((t: any) => t.status === 'BELUM_LUNAS')
            .sort((a: any, b: any) => new Date(a.jatuhTempo).getTime() - new Date(b.jatuhTempo).getTime())[0]

          if (tagihanTerdekat) {
            setNextJatuhTempo(tagihanTerdekat.jatuhTempo)
          }
        }
      } catch (error) {
        console.error('[JatuhTempoDenganInfo] Error fetching next jatuh tempo:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNextJatuhTempo()

    // Auto-refresh setiap 30 detik
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
        <p className="text-xs text-white/70">Memuat info pembayaran...</p>
      ) : (
        nextJatuhTempo && (
          <p className="text-xs text-white/70 mt-1">
            Pembayaran berikutnya: {formatDateShort(nextJatuhTempo)}
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
function SaldoTagihan({ pelangganId, isOverdue }: { pelangganId: string; isOverdue: boolean }) {
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

          // Hitung total tagihan yang belum dibayar
          const totalBelumBayar = tagihans
            .filter((t: any) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT')
            .reduce((sum: number, t: any) => sum + t.total, 0)

          setSaldo(totalBelumBayar)
        }
      } catch (error) {
        console.error('[SaldoTagihan] Error fetching saldo:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSaldo()

    // Auto-refresh setiap 30 detik
    const intervalId = setInterval(() => {
      fetchSaldo()
    }, 30000) // 30 detik

    // Auto-refresh ketika tab/window di-focus
    const handleFocus = () => {
      fetchSaldo()
    }
    window.addEventListener('focus', handleFocus)

    // Auto-refresh ketika visibility berubah
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchSaldo()
      }
    }
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
    return <p className="text-lg font-bold text-sky-500">...</p>
  }

  return (
    <p className="text-lg font-bold text-sky-500">
      {formatRupiah(saldo || 0)}
    </p>
  )
}



export default function PelangganDashboardPage() {
  const router = useRouter()
  const { data: pelanggan, loading, refreshing, lastRefreshTime, refresh } = usePelanggan()


  // State untuk deteksi online/offline
  const [isOnline, setIsOnline] = useState(true)

  // State untuk PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  // Data usage untuk monitoring bandwidth
  const [dataUsage, setDataUsage] = useState({
    upload: { used: 2.5, total: 10, unit: 'GB' },
    download: { used: 8.7, total: 50, unit: 'GB' }
  })

  // Deteksi status online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    // Set status awal
    setIsOnline(navigator.onLine)

    // Tambahkan event listener
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // PWA install prompt handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Stash the event so it can be triggered later
      setDeferredPrompt(e)
      // Show the install banner
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed) {
        setShowInstallPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('pelanggan_token')
    localStorage.removeItem('pelanggan_data')
    router.push('/pelanggan/login')
  }

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    // Parse tanggal dengan benar untuk menghindari timezone issue
    let date: Date
    if (dateString.includes('T')) {
      // ISO format dengan time
      date = new Date(dateString)
    } else {
      // Format YYYY-MM-DD, parse sebagai local date
      const [year, month, day] = dateString.split('-').map(Number)
      date = new Date(year, month - 1, day)
    }

    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }


  const isJatuhTempo = (jatuhTempo: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Parse tanggal dengan benar
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

  const getDaysUntilJatuhTempo = (jatuhTempo: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Parse tanggal dengan benar
    let jatuhTempoDate: Date
    if (jatuhTempo.includes('T')) {
      jatuhTempoDate = new Date(jatuhTempo)
    } else {
      const [year, month, day] = jatuhTempo.split('-').map(Number)
      jatuhTempoDate = new Date(year, month - 1, day)
    }
    jatuhTempoDate.setHours(0, 0, 0, 0)
    const diffTime = jatuhTempoDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <HiArrowPath className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
          <div className="text-gray-500 dark:text-gray-400">Memuat data...</div>
        </div>
      </div>
    )
  }

  if (!pelanggan) {
    return null
  }

  const daysUntilJatuhTempo = pelanggan ? getDaysUntilJatuhTempo(pelanggan.jatuhTempo) : 0
  const isOverdue = pelanggan ? isJatuhTempo(pelanggan.jatuhTempo) : false

  const uploadPercentage = (dataUsage.upload.used / dataUsage.upload.total) * 100
  const downloadPercentage = (dataUsage.download.used / dataUsage.download.total) * 100

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
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
                className="px-3 py-1 text-sm hover:bg-sky-600 rounded transition-colors touch-manipulation"
              >
                Nanti
              </button>
              <button
                onClick={handleInstall}
                className="px-4 py-1.5 text-sm font-medium bg-white text-sky-600 rounded hover:bg-gray-100 transition-colors touch-manipulation"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sky Blue Header - Mobile App Style */}
      <header className="bg-gradient-to-r from-sky-400 to-cyan-500 text-white shadow-lg md:ml-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if ((window as any).togglePelangganSidebar) {
                    ; (window as any).togglePelangganSidebar()
                  }
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation md:hidden"
                aria-label="Open menu"
              >
                <HiBars3 className="w-6 h-6" />
              </button>
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold">N</span>
              </div>
              <h1 className="text-xl font-bold">NetManager</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refresh()}
                disabled={loading || refreshing}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation disabled:opacity-50 relative"
                title="Refresh"
              >
                <HiArrowPath className={`w-6 h-6 ${loading || refreshing ? 'animate-spin' : ''}`} />
                {refreshing && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                )}
              </button>
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation">
                <HiBell className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        {lastRefreshTime && (
          <div className="mb-2 text-center">
            <span className="text-xs text-gray-500">
              Terakhir diperbarui: {lastRefreshTime.toLocaleTimeString('id-ID')}
            </span>
          </div>
        )}
        {/* Welcome Card */}
        {/* Client Info Card - Mobile App Style */}
        <div className="bg-white rounded-2xl shadow-md mb-4 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <HiOutlineUser className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Client</p>
                <p className="text-sm font-semibold text-gray-900">{pelanggan.noTelp || pelanggan.idPelanggan}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Saldo Tagihan</p>
              <SaldoTagihan pelangganId={pelanggan.id} isOverdue={isOverdue} />
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/pelanggan/tagihan"
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 active:scale-95 transition-transform touch-manipulation"
            >
              <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                <HiOutlineCreditCard className="w-5 h-5 text-sky-600" />
              </div>
              <span className="text-xs font-medium text-gray-700">Bayar Tagihan</span>
            </Link>
            <Link
              href="/pelanggan/tagihan?tab=riwayat"
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 active:scale-95 transition-transform touch-manipulation"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <HiArrowRight className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-700">Riwayat</span>
            </Link>
            <Link
              href="/pelanggan/bantuan"
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 active:scale-95 transition-transform touch-manipulation"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <HiOutlineInformationCircle className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-xs font-medium text-gray-700">Bantuan</span>
            </Link>
          </div>
        </div>

        {/* Data Usage Section - Mobile App Style */}
        <div className="bg-gradient-to-br from-sky-400 to-cyan-500 rounded-2xl shadow-lg mb-4 p-5 text-white">
          {/* Tabs - Removed HOTSPOT tab as it's not implemented */}
          <div className="flex gap-2 mb-2">
            <div className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium">
              PAKET INTERNET
            </div>
          </div>
          <p className="text-xs text-white/60 mb-4">* Data usage merupakan data demo. Integrasi dengan sistem monitoring sedang dalam pengembangan.</p>

          {/* Progress Indicators */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Upload */}
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-2">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - uploadPercentage / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{dataUsage.upload.used}</span>
                </div>
              </div>
              <p className="text-xs text-white/80">UPLOAD</p>
              <p className="text-xs text-white/60">{dataUsage.upload.unit}</p>
            </div>

            {/* Download */}
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-2">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - downloadPercentage / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{dataUsage.download.used}</span>
                </div>
              </div>
              <p className="text-xs text-white/80">DOWNLOAD</p>
              <p className="text-xs text-white/60">{dataUsage.download.unit}</p>
            </div>
          </div>

          {/* Status and Expiry */}
          <div className="flex items-center justify-between pt-4 border-t border-white/20">
            <button className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium">
              {pelanggan.status === 'AKTIF' ? 'AKTIF' : 'NONAKTIF'}
            </button>
            <div className="text-right">
              <p className="text-xs text-white/80">Kadaluarsa</p>
              <JatuhTempoDenganInfo
                pelangganId={pelanggan.id}
                pelangganJatuhTempo={pelanggan.jatuhTempo}
              />
            </div>
          </div>
        </div>

        {/* RADIUS Session Status */}
        <ConnectionStatusCard />

        {/* RADIUS Usage Stats */}
        <UsageStatsCard />

        {/* RADIUS Session History */}
        <SessionHistoryTable />


        {/* Alert Jatuh Tempo */}
        {isOverdue && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <HiOutlineClock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 mb-1">
                  ⚠️ Tagihan Anda sudah jatuh tempo
                </p>
                <p className="text-xs text-red-600">
                  Silakan lakukan pembayaran untuk menghindari gangguan layanan
                </p>
              </div>
            </div>
          </div>
        )}


      </main>

      {/* Bottom Navigation - Mobile App Style */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg md:hidden">
        <div className="flex items-center justify-around h-16">
          <Link
            href="/pelanggan"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-sky-500 touch-manipulation relative"
            aria-label="Beranda"
          >
            <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
              <HiOutlineHome className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Beranda</span>
          </Link>
          <Link
            href="/pelanggan/tagihan"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
            aria-label="Tagihan"
          >
            <HiOutlineDocumentText className="w-6 h-6" />
            <span className="text-xs font-medium">Tagihan</span>
          </Link>
          <Link
            href="/pelanggan/profil"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
            aria-label="Profil"
          >
            <HiOutlineUser className="w-6 h-6" />
            <span className="text-xs font-medium">Profil</span>
          </Link>
          <Link
            href="/pelanggan/bantuan"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
            aria-label="Bantuan"
          >
            <HiOutlineInformationCircle className="w-6 h-6" />
            <span className="text-xs font-medium">Bantuan</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
