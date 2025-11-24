"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiArrowRightOnRectangle,
  HiOutlineUser,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineCreditCard,
  HiOutlineCalendar,
  HiArrowLeft,
  HiOutlineHome,
  HiOutlineInformationCircle,
  HiBell,
  HiOutlineDocumentText,
} from 'react-icons/hi2'
import Link from 'next/link'

export default function ProfilPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pelanggan, setPelanggan] = useState<any>(null)

  useEffect(() => {
    const loadPelangganData = async () => {
      const token = localStorage.getItem('pelanggan_token')
      const pelangganData = localStorage.getItem('pelanggan_data')

      if (!token || !pelangganData) {
        router.push('/pelanggan/login')
        return
      }

      try {
        // Parse data dari localStorage sebagai fallback
        const cachedData = JSON.parse(pelangganData)
        
        // Fetch data terbaru dari API untuk mendapatkan data yang sudah di-update
        try {
          const response = await fetch(`/api/pelanggan-ppp/${cachedData.id}`, {
            headers: {
              'x-pelanggan-token': token,
              'Cache-Control': 'no-cache',
            },
            cache: 'no-store',
          })
          
          if (response.ok) {
            const freshData = await response.json()
            
            // Debug: Log data yang diterima
            console.log('[Profil] Data pelanggan dari API:', {
              id: freshData.id,
              idPelanggan: freshData.idPelanggan,
              nama: freshData.nama,
              jatuhTempo: freshData.jatuhTempo,
              jatuhTempoType: typeof freshData.jatuhTempo,
            })
            
            // Update localStorage dengan data terbaru
            localStorage.setItem('pelanggan_data', JSON.stringify(freshData))
            setPelanggan(freshData)
          } else {
            // Jika API gagal, gunakan data dari cache
            console.warn('Failed to fetch fresh data, using cached data')
            setPelanggan(cachedData)
          }
        } catch (apiError) {
          // Jika API error, gunakan data dari cache
          console.warn('API error, using cached data:', apiError)
          setPelanggan(cachedData)
        }
      } catch (error) {
        console.error('Error parsing pelanggan data:', error)
        router.push('/pelanggan/login')
      } finally {
        setLoading(false)
      }
    }
    
    loadPelangganData()
    
    // Auto-refresh setiap 30 detik
    const intervalId = setInterval(() => {
      console.log('[Profil] Auto-refresh data pelanggan...')
      loadPelangganData()
    }, 30000) // 30 detik
    
    // Refresh data saat halaman di-focus
    const handleFocus = () => {
      console.log('[Profil] Tab focused, refresh data...')
      loadPelangganData()
    }
    window.addEventListener('focus', handleFocus)
    
    // Auto-refresh ketika visibility berubah
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[Profil] Tab visible, refresh data...')
        loadPelangganData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('pelanggan_token')
    localStorage.removeItem('pelanggan_data')
    router.push('/pelanggan/login')
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

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Memuat data...</div>
      </div>
    )
  }

  if (!pelanggan) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {/* Sky Blue Header - Mobile App Style */}
      <header className="bg-gradient-to-r from-sky-400 to-cyan-500 text-white shadow-lg">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/pelanggan"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
              >
                <HiArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold">Profil Saya</h1>
            </div>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation">
              <HiBell className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-sky-400 to-cyan-500 rounded-full flex items-center justify-center">
              <HiOutlineUser className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {pelanggan.nama}
              </h2>
              <p className="text-sm text-gray-500">
                ID Pelanggan: {pelanggan.idPelanggan}
              </p>
            </div>
          </div>
        </div>

        {/* Informasi Akun */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Akun</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <HiOutlineUser className="w-5 h-5 text-sky-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Nama Lengkap</p>
                <p className="text-sm font-medium text-gray-900">{pelanggan.nama}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <HiOutlineCreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Username PPPoE</p>
                <p className="text-sm font-medium text-gray-900 font-mono">
                  {pelanggan.username}
                </p>
              </div>
            </div>
            {pelanggan.email && (
              <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HiOutlineEnvelope className="w-5 h-5 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="text-sm font-medium text-gray-900">
                    {pelanggan.email}
                  </p>
                </div>
              </div>
            )}
            {pelanggan.noTelp && (
              <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HiOutlinePhone className="w-5 h-5 text-teal-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">No. Telepon</p>
                  <p className="text-sm font-medium text-gray-900">
                    {pelanggan.noTelp}
                  </p>
                </div>
              </div>
            )}
            {pelanggan.alamat && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HiOutlineMapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Alamat</p>
                  <p className="text-sm font-medium text-gray-900">
                    {pelanggan.alamat}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informasi Paket */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Paket</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <HiOutlineCreditCard className="w-5 h-5 text-sky-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Paket Internet</p>
                <p className="text-sm font-medium text-gray-900">
                  {pelanggan.hargaPaket?.name || '-'}
                </p>
                {pelanggan.hargaPaket && (
                  <p className="text-xs text-gray-500 mt-1">
                    {formatRupiah(pelanggan.hargaPaket.harga)}/bulan
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <HiOutlineCalendar className="w-5 h-5 text-cyan-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Tanggal Aktif</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(pelanggan.tanggalAktif)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <HiOutlineCalendar className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Jatuh Tempo</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(pelanggan.jatuhTempo)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <HiOutlineUser className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className="text-sm font-medium text-gray-900">
                  {pelanggan.status} ({pelanggan.tipe === 'REGULER' ? 'Reguler' : 'Non Reguler'})
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-50 text-red-600 border border-red-200 rounded-xl px-6 py-3 font-medium hover:bg-red-100 transition-colors touch-manipulation active:scale-95 flex items-center justify-center gap-2"
        >
          <HiArrowRightOnRectangle className="w-5 h-5" />
          Keluar dari Akun
        </button>
      </main>

      {/* Bottom Navigation - Mobile App Style */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg md:hidden">
        <div className="flex items-center justify-around h-16">
          <Link
            href="/pelanggan"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
          >
            <HiOutlineHome className="w-6 h-6" />
            <span className="text-xs font-medium">Beranda</span>
          </Link>
          <Link
            href="/pelanggan/tagihan"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
          >
            <HiOutlineDocumentText className="w-6 h-6" />
            <span className="text-xs font-medium">Tagihan</span>
          </Link>
          <Link
            href="/pelanggan/profil"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-sky-500 touch-manipulation"
          >
            <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
              <HiOutlineUser className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Profil</span>
          </Link>
          <Link
            href="/pelanggan/bantuan"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
          >
            <HiOutlineInformationCircle className="w-6 h-6" />
            <span className="text-xs font-medium">Bantuan</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
