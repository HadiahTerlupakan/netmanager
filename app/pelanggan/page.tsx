"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiArrowRightOnRectangle, HiOutlineUser, HiOutlineCalendar, HiOutlineCreditCard, HiOutlineClock } from 'react-icons/hi2'

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

  useEffect(() => {
    // Cek apakah user sudah login
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
  }, [router])

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Memuat data...</div>
      </div>
    )
  }

  if (!pelanggan) {
    return null
  }

  const daysUntilJatuhTempo = getDaysUntilJatuhTempo(pelanggan.jatuhTempo)
  const isOverdue = isJatuhTempo(pelanggan.jatuhTempo)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">NetManager</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Portal Pelanggan</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <HiArrowRightOnRectangle className="w-4 h-4" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Selamat Datang, {pelanggan.nama}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            ID Pelanggan: {pelanggan.idPelanggan}
          </p>
        </div>

        {/* Alert Jatuh Tempo */}
        {isOverdue && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <HiOutlineClock className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-400">
                  ⚠️ Tagihan Anda sudah jatuh tempo
                </p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  Silakan lakukan pembayaran untuk menghindari gangguan layanan
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Paket */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <HiOutlineCreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Paket Internet</h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {pelanggan.hargaPaket?.name || '-'}
                </p>
              </div>
            </div>
            {pelanggan.hargaPaket && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatRupiah(pelanggan.hargaPaket.harga)}
              </p>
            )}
          </div>

          {/* Jatuh Tempo */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${
                isOverdue
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : daysUntilJatuhTempo <= 7
                  ? 'bg-yellow-100 dark:bg-yellow-900/30'
                  : 'bg-green-100 dark:bg-green-900/30'
              }`}>
                <HiOutlineCalendar className={`w-6 h-6 ${
                  isOverdue
                    ? 'text-red-600 dark:text-red-400'
                    : daysUntilJatuhTempo <= 7
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400'
                }`} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Jatuh Tempo</h3>
                <p className={`text-lg font-semibold ${
                  isOverdue
                    ? 'text-red-600 dark:text-red-400'
                    : daysUntilJatuhTempo <= 7
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {formatDate(pelanggan.jatuhTempo)}
                </p>
              </div>
            </div>
            {isOverdue ? (
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                Terlambat {Math.abs(daysUntilJatuhTempo)} hari
              </p>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {daysUntilJatuhTempo > 0 ? `${daysUntilJatuhTempo} hari lagi` : 'Hari ini'}
              </p>
            )}
          </div>

          {/* Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${
                pelanggan.status === 'AKTIF'
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-gray-100 dark:bg-gray-900/30'
              }`}>
                <HiOutlineUser className={`w-6 h-6 ${
                  pelanggan.status === 'AKTIF'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
                <p className={`text-lg font-semibold ${
                  pelanggan.status === 'AKTIF'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {pelanggan.status}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tipe: {pelanggan.tipe === 'REGULER' ? '📅 Reguler' : '🔄 Non Reguler'}
            </p>
          </div>
        </div>

        {/* Detail Informasi */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Informasi Pelanggan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Username PPPoE</h4>
              <p className="text-sm text-gray-900 dark:text-white">{pelanggan.username}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tanggal Aktif</h4>
              <p className="text-sm text-gray-900 dark:text-white">{formatDate(pelanggan.tanggalAktif)}</p>
            </div>
            {pelanggan.email && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Email</h4>
                <p className="text-sm text-gray-900 dark:text-white">{pelanggan.email}</p>
              </div>
            )}
            {pelanggan.noTelp && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">No. Telepon</h4>
                <p className="text-sm text-gray-900 dark:text-white">{pelanggan.noTelp}</p>
              </div>
            )}
            {pelanggan.alamat && (
              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Alamat</h4>
                <p className="text-sm text-gray-900 dark:text-white">{pelanggan.alamat}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

