"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiArrowRightOnRectangle,
  HiOutlineUser,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineCreditCard,
  HiOutlineCalendar,
  HiArrowPath,
} from 'react-icons/hi2'

export default function ProfilPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pelanggan, setPelanggan] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const isRefreshingRef = useRef(false)

  const loadPelangganData = useCallback(async (forceRefresh = false, showRefreshing = false) => {
    if (isRefreshingRef.current && !forceRefresh) {
      return
    }

    const token = localStorage.getItem('pelanggan_token')
    const pelangganData = localStorage.getItem('pelanggan_data')

    if (!token || !pelangganData) {
      router.push('/pelanggan/login')
      return
    }

    if (showRefreshing) setRefreshing(true)
    isRefreshingRef.current = true

    try {
      const cachedData = JSON.parse(pelangganData)

      try {
        const cacheBuster = forceRefresh ? `?_t=${Date.now()}` : ''
        const response = await fetch(`/api/pelanggan/me${cacheBuster}`, {
          headers: {
            'Cache-Control': 'no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'x-pelanggan-token': token,
          },
        })

        if (!response.ok) {
          throw new Error('Gagal memuat data pelanggan')
        }

        const data = await response.json()
        setPelanggan(data)
        localStorage.setItem('pelanggan_data', JSON.stringify(data))

        if (showRefreshing) {
          setLastRefreshTime(new Date())
        }
      } catch (fetchError) {
        console.error('Error fetching pelanggan data:', fetchError)
        setPelanggan(cachedData)
      }
    } catch (error) {
      console.error('Error loading pelanggan data:', error)
      router.push('/pelanggan/login')
    } finally {
      setLoading(false)
      if (showRefreshing) setRefreshing(false)
      isRefreshingRef.current = false
    }
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem('pelanggan_token')
    const pelangganData = localStorage.getItem('pelanggan_data')

    if (!token || !pelangganData) {
      router.push('/pelanggan/login')
      return
    }

    loadPelangganData()

    const intervalId = setInterval(() => {
      loadPelangganData(false, false)
    }, 30000)

    const handleFocus = () => loadPelangganData(true, false)
    const handleVisibilityChange = () => {
      if (!document.hidden) loadPelangganData(true, false)
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router, loadPelangganData])

  const handleLogout = () => {
    localStorage.removeItem('pelanggan_token')
    localStorage.removeItem('pelanggan_data')
    router.push('/pelanggan/login')
  }

  const formatDate = (dateString: string) => {
    let date: Date
    if (dateString.includes('T')) {
      date = new Date(dateString)
    } else {
      const [year, month, day] = dateString.split('-').map(Number)
      date = new Date(year, month - 1, day)
    }

    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <HiArrowPath className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-spin mx-auto mb-4" />
          <div className="text-gray-600 dark:text-gray-400">Memuat data...</div>
        </div>
      </div>
    )
  }

  if (!pelanggan) {
    return null
  }

  return (
    <>
      {/* Main Content Container */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profil Saya</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Informasi akun dan paket Anda</p>
              </div>
              <button
                onClick={() => loadPelangganData(true, true)}
                disabled={loading || refreshing}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 relative"
                title="Refresh"
              >
                <HiArrowPath className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${loading || refreshing ? 'animate-spin' : ''}`} />
                {refreshing && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="px-4 py-6 md:px-6 lg:px-8 max-w-5xl mx-auto">
          {lastRefreshTime && (
            <div className="mb-4 text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Terakhir diperbarui: {lastRefreshTime.toLocaleTimeString('id-ID')}
              </span>
            </div>
          )}

          {/* Profile Header Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-sky-400 to-cyan-500 rounded-full flex items-center justify-center">
                <HiOutlineUser className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {pelanggan.nama}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ID Pelanggan: {pelanggan.idPelanggan}
                </p>
              </div>
            </div>
          </div>

          {/* Informasi Akun */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informasi Akun</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/20 rounded-lg flex items-center justify-center shrink-0">
                  <HiOutlineUser className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nama Lengkap</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{pelanggan.nama}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center shrink-0">
                  <HiOutlineCreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Username PPPoE</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                    {pelanggan.username}
                  </p>
                </div>
              </div>
              {pelanggan.email && (
                <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/20 rounded-lg flex items-center justify-center shrink-0">
                    <HiOutlineEnvelope className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pelanggan.email}
                    </p>
                  </div>
                </div>
              )}
              {pelanggan.noTelp && (
                <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/20 rounded-lg flex items-center justify-center shrink-0">
                    <HiOutlinePhone className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">No. Telepon</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pelanggan.noTelp}
                    </p>
                  </div>
                </div>
              )}
              {pelanggan.alamat && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center shrink-0">
                    <HiOutlineMapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Alamat</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pelanggan.alamat}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informasi Paket */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informasi Paket</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/20 rounded-lg flex items-center justify-center shrink-0">
                  <HiOutlineCreditCard className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Paket Internet</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {pelanggan.hargaPaket?.name || '-'}
                  </p>
                  {pelanggan.hargaPaket && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatRupiah(pelanggan.hargaPaket.harga)}/bulan
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/20 rounded-lg flex items-center justify-center shrink-0">
                  <HiOutlineCalendar className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tanggal Aktif</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(pelanggan.tanggalAktif)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center shrink-0">
                  <HiOutlineCalendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Jatuh Tempo</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(pelanggan.jatuhTempo)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/20 rounded-lg flex items-center justify-center shrink-0">
                  <HiOutlineUser className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {pelanggan.status} ({pelanggan.tipe === 'REGULER' ? 'Reguler' : 'Non Reguler'})
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl px-6 py-3 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            <HiArrowRightOnRectangle className="w-5 h-5" />
            Keluar dari Akun
          </button>
        </main>
      </div>
    </>
  )
}
