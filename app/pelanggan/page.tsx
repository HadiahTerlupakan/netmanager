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

type PelangganData = {
  id: string
  idPelanggan: string
  nama: string
  username: string
  tipe: 'REGULER' | 'NON_REGULER'
  hargaPaket?: {
    name: string
    harga: number
  } | null
  tanggalAktif: string
  jatuhTempo: string
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  alamat?: string | null
  noTelp?: string | null
  email?: string | null
}

export default function PelangganDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pelanggan, setPelanggan] = useState<PelangganData | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  // Dummy data untuk penggunaan data (akan diganti dengan data real nanti)
  const [dataUsage] = useState({
    upload: { used: 572.1, total: 1000, unit: 'MB' },
    download: { used: 11.4, total: 100, unit: 'GB' },
  })

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check if already installed or dismissed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches
    const wasDismissed = localStorage.getItem('pwa-install-dismissed') === 'true'
    const wasInstalled = localStorage.getItem('pwa-installed') === 'true'

    if (isInstalled || wasInstalled || wasDismissed) {
      setShowInstallPrompt(false)
    }

    // Handle PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show install prompt after 3 seconds if not installed/dismissed
      if (!isInstalled && !wasDismissed && !wasInstalled) {
        setTimeout(() => setShowInstallPrompt(true), 3000)
      }
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  useEffect(() => {
    loadPelangganData()
  }, [])

  const loadPelangganData = async () => {
    const token = localStorage.getItem('pelanggan_token')
    const pelangganData = localStorage.getItem('pelanggan_data')

    if (!token || !pelangganData) {
      router.push('/pelanggan/login')
      return
    }

    try {
      const data = JSON.parse(pelangganData)
      setPelanggan(data)
    } catch (error) {
      console.error('Error parsing pelanggan data:', error)
      router.push('/pelanggan/login')
    } finally {
      setLoading(false)
    }
  }


  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response to install prompt: ${outcome}`)
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
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString)
    const month = date.toLocaleDateString('id-ID', { month: 'short' })
    const day = date.getDate()
    const year = date.getFullYear()
    return `${month.charAt(0).toUpperCase() + month.slice(1)}, ${day.toString().padStart(2, '0')} ${year} 00:00`
  }

  const isJatuhTempo = (jatuhTempo: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const jatuhTempoDate = new Date(jatuhTempo)
    jatuhTempoDate.setHours(0, 0, 0, 0)
    return jatuhTempoDate < today
  }

  const getDaysUntilJatuhTempo = (jatuhTempo: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const jatuhTempoDate = new Date(jatuhTempo)
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
                    ;(window as any).togglePelangganSidebar()
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
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation">
              <HiBell className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
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
              <p className="text-lg font-bold text-sky-500">
                {isOverdue ? formatRupiah(0) : formatRupiah(pelanggan.hargaPaket?.harga || 0)}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-4 gap-2">
            <Link
              href="/pelanggan/tagihan"
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 active:scale-95 transition-transform touch-manipulation"
            >
              <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                <HiOutlineCreditCard className="w-5 h-5 text-sky-600" />
              </div>
              <span className="text-xs font-medium text-gray-700">Isi Ulang</span>
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
            <button className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 active:scale-95 transition-transform touch-manipulation">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <HiArrowDownTray className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-700">Unduh</span>
            </button>
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
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium">
              TAHUNAN
            </button>
            <button className="px-4 py-2 bg-transparent rounded-lg text-sm font-medium text-white/70">
              HOTSPOT
            </button>
          </div>

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
              <p className="text-sm font-semibold">
                {formatDateShort(pelanggan.jatuhTempo)}
              </p>
            </div>
          </div>
        </div>

        {/* Main Navigation Icons */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Link
            href="/pelanggan"
            className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm active:scale-95 transition-transform touch-manipulation"
          >
            <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center">
              <HiWifi className="w-6 h-6 text-sky-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Langganan</span>
          </Link>
          <button className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm active:scale-95 transition-transform touch-manipulation">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <HiPlus className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Pembelian</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm active:scale-95 transition-transform touch-manipulation">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <HiTicket className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Vouchers</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm active:scale-95 transition-transform touch-manipulation">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <HiUserGroup className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Keagenan</span>
          </button>
        </div>

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

        {/* Penawaran Terbaik Section (Optional) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">Penawaran Terbaik</h3>
            <Link href="/pelanggan/tagihan" className="text-sm text-sky-500 font-medium">
              Lainnya &gt;
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {/* Voucher Cards */}
            {[20, 10, 30].map((amount, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 w-48 bg-gradient-to-br from-sky-400 to-cyan-500 rounded-xl p-4 text-white shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs bg-white/20 px-2 py-1 rounded">1</span>
                </div>
                <p className="text-2xl font-bold mb-1">Rp {amount}</p>
                <p className="text-xs text-white/80 mb-1">{(amount * 100).toLocaleString('id-ID')} pts</p>
                <p className="text-xs text-white/70">Voucher Pulsa {amount}rb</p>
                <p className="text-xs text-white/70">Voucher Hadiah Pulsa</p>
              </div>
            ))}
          </div>
        </div>
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
