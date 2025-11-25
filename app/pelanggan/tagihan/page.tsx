"use client"

import { useEffect, useState, Suspense, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  HiOutlineCreditCard,
  HiOutlineDocumentText,
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineXCircle,
  HiArrowLeft,
  HiOutlineHome,
  HiOutlineUser,
  HiOutlineInformationCircle,
  HiBell,
  HiArrowPath,
} from 'react-icons/hi2'
import Link from 'next/link'

type TagihanItem = {
  id: string
  bulan: string
  tahun: number
  jumlah: number
  jatuhTempo: string
  status: 'LUNAS' | 'BELUM_LUNAS' | 'TERLAMBAT'
  tanggalBayar?: string
}

// Module-level constants
const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

function TagihanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'tagihan'
  const [loading, setLoading] = useState(true)
  const [pelanggan, setPelanggan] = useState<any>(null)
  const [tagihanList, setTagihanList] = useState<TagihanItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [renewing, setRenewing] = useState(false)
  const [renewDisabled, setRenewDisabled] = useState(false)
  const [renewDisabledMessage, setRenewDisabledMessage] = useState<string | null>(null)
  const [checkingRenewStatus, setCheckingRenewStatus] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false) // Deprecated: causing re-renders
  const isRefreshingRef = useRef(false) // Use ref for lock to prevent re-renders

  // Fungsi untuk fetch tagihan dengan cache busting dan locking
  const fetchTagihan = useCallback(async (showLoading = true, forceRefresh = false) => {
    // Cegah multiple refresh simultan
    if (isRefreshingRef.current && !forceRefresh) {
      return
    }

    const token = localStorage.getItem('pelanggan_token')
    const pelangganData = localStorage.getItem('pelanggan_data')

    if (!token || !pelangganData) {
      router.push('/pelanggan/login')
      return
    }

    try {
      const data = JSON.parse(pelangganData)
      if (showLoading) setLoading(true)

      // Set lock untuk mencegah multiple refresh
      isRefreshingRef.current = true

      // Tambahkan timestamp untuk cache busting jika forceRefresh true
      // Gunakan format yang tidak mengganggu routing Next.js
      const cacheBuster = forceRefresh ? `?_t=${Date.now()}` : ''

      const response = await fetch(`/api/tagihan/pelanggan/${data.id}${cacheBuster}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'x-pelanggan-token': token,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Portal Tagihan] Error response:', errorText)

        if (response.status === 404) {
          throw new Error('Endpoint tidak ditemukan. Silakan refresh halaman.')
        } else if (response.status === 401) {
          throw new Error('Sesi Anda telah berakhir. Silakan login kembali.')
        } else if (response.status === 500) {
          throw new Error('Terjadi kesalahan server. Silakan coba lagi nanti.')
        } else {
          throw new Error(`Gagal mengambil data tagihan (${response.status})`)
        }
      }
      const tagihans = await response.json()

      // Transform data dari API ke format TagihanItem
      const transformedTagihans: TagihanItem[] = tagihans.map((tagihan: any) => ({
        id: tagihan.id,
        bulan: NAMA_BULAN[tagihan.periodeBulan - 1],
        tahun: tagihan.periodeTahun,
        jumlah: tagihan.total,
        jatuhTempo: tagihan.jatuhTempo,
        status: tagihan.status,
        tanggalBayar: tagihan.tanggalBayar || undefined,
      }))

      // Cek duplikasi periode dan gunakan yang terbaru
      const periodeMap = new Map<string, TagihanItem>()

      transformedTagihans.forEach(tagihan => {
        const key = `${tagihan.bulan}-${tagihan.tahun}`
        if (!periodeMap.has(key)) {
          periodeMap.set(key, tagihan)
        }
      })

      // Gunakan data unik berdasarkan periode
      const uniqueTagihans = Array.from(periodeMap.values())
      setTagihanList(uniqueTagihans)

      // Cek status disable perpanjangan jika semua tagihan sudah lunas
      const tagihanAktifCount = uniqueTagihans.filter(
        (t: TagihanItem) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT'
      ).length
      const riwayatCount = uniqueTagihans.filter((t: TagihanItem) => t.status === 'LUNAS').length
      const semuaLunas = tagihanAktifCount === 0 && riwayatCount > 0

      if (semuaLunas && data.jatuhTempo) {
        setCheckingRenewStatus(true)
        try {
          const renewStatusRes = await fetch(`/api/pelanggan-ppp/${data.id}/check-renew`, {
            headers: {
              'x-pelanggan-token': token || '',
            },
          })
          if (renewStatusRes.ok) {
            const renewStatusData = await renewStatusRes.json()
            setRenewDisabled(renewStatusData.disabled)
            setRenewDisabledMessage(renewStatusData.message)
          }
        } catch (err) {
          console.error('Error checking renew status:', err)
        } finally {
          setCheckingRenewStatus(false)
        }
      }

      // Update last refresh time after successful fetch
      setLastRefreshTime(new Date())
    } catch (err: any) {
      console.error('Error fetching tagihan:', err)
      setError(err.message || 'Gagal mengambil data tagihan')
    } finally {
      if (showLoading) setLoading(false)
      // Release lock setelah selesai
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

    try {
      const data = JSON.parse(pelangganData)
      setPelanggan(data)

      // Fetch tagihan pertama kali
      fetchTagihan()

      // Auto-refresh setiap 30 detik (increased from 15 to reduce load)
      let refreshCount = 0
      let lastInteractionRefresh = 0

      const intervalId = setInterval(() => {
        refreshCount++
        // Gunakan forceRefresh setiap 4 kali refresh untuk memastikan data terbaru
        fetchTagihan(false, refreshCount % 4 === 0)
      }, 30000) // 30 detik

      // Event listener untuk refresh saat tab di-focus atau visible
      const handlePageInteraction = () => {
        const now = Date.now()
        // Hanya refresh jika sudah 10 detik sejak refresh terakhir
        if (now - lastInteractionRefresh > 10000) {
          lastInteractionRefresh = now
          fetchTagihan(false, true) // Gunakan forceRefresh saat ada interaksi
        }
      }

      // Auto-refresh ketika tab/window di-focus
      const handleFocus = () => {
        handlePageInteraction()
      }
      window.addEventListener('focus', handleFocus)

      // Auto-refresh ketika visibility berubah (user kembali ke tab)
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          handlePageInteraction()
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      // Cleanup
      return () => {
        clearInterval(intervalId)
        window.removeEventListener('focus', handleFocus)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    } catch (error) {
      console.error('Error parsing pelanggan data:', error)
      router.push('/pelanggan/login')
    }
  }, [router, fetchTagihan])

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
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate()
    const month = date.toLocaleDateString('id-ID', { month: 'short' })
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  // Check if date is overdue
  const isDateOverdue = (dateString: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const date = new Date(dateString)
    return date < today
  }

  // Helper untuk membandingkan dua tanggal tanpa waktu
  const areDatesSame = (date1: string, date2: string) => {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    return d1.toDateString() === d2.toDateString()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LUNAS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <HiOutlineCheckCircle className="w-4 h-4" />
            Lunas
          </span>
        )
      case 'TERLAMBAT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <HiOutlineXCircle className="w-4 h-4" />
            Terlambat
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <HiOutlineClock className="w-4 h-4" />
            Belum Lunas
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Memuat data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  const tagihanAktif = tagihanList.filter((t) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT')
  const riwayatBayar = tagihanList.filter((t) => t.status === 'LUNAS')
  const semuaTagihanLunas = tagihanAktif.length === 0 && riwayatBayar.length > 0

  const handleRefresh = async () => {
    setRefreshing(true)

    // Tambahkan timestamp unik untuk memaksa refresh dari server
    await fetchTagihan(true, true) // Gunakan forceRefresh untuk cache busting

    setLastRefreshTime(new Date())
    setRefreshing(false)

    // Tampilkan notifikasi singkat
    const notification = document.createElement('div')
    notification.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse'
    notification.textContent = 'Data berhasil diperbarui dari server'
    document.body.appendChild(notification)

    // Hapus notifikasi setelah 2 detik
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification)
      }
    }, 2000)
  }

  const handleRenew = async () => {
    if (!pelanggan) return

    if (!confirm('Apakah Anda yakin ingin memperpanjang layanan? Tagihan baru akan dibuat untuk periode berikutnya.')) {
      return
    }

    try {
      setRenewing(true)
      const token = localStorage.getItem('pelanggan_token')
      const res = await fetch(`/api/pelanggan-ppp/${pelanggan.id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pelanggan-token': token || '',
        },
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal memperpanjang layanan')
      }

      const data = await res.json()
      alert(`Layanan berhasil diperpanjang!\nJatuh Tempo Baru: ${new Date(data.jatuhTempoBaru).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}`)

      // Gunakan fetchTagihan yang sudah diperbaiki untuk reload data
      await fetchTagihan(false, true) // Gunakan forceRefresh untuk memastikan data terbaru
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memperpanjang layanan')
    } finally {
      setRenewing(false)
    }
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
              <h1 className="text-xl font-bold">Tagihan & Pembayaran</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation disabled:opacity-50 relative"
                title="Refresh Data"
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

      {/* Client Info - Matching Dashboard Style */}
      {pelanggan && (
        <div className="bg-white rounded-2xl shadow-sm mb-4 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <HiOutlineUser className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Client</p>
                <p className="text-sm font-semibold text-gray-900">{pelanggan.noTelp || pelanggan.idPelanggan}</p>
                <p className="text-xs text-gray-500">Status: {pelanggan.status}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Jatuh Tempo</p>
              <div>
                <p className="text-sm font-semibold">
                  {formatDateShort(pelanggan.jatuhTempo)}
                </p>
                {isDateOverdue(pelanggan.jatuhTempo) && (
                  <p className="text-xs text-yellow-600">
                    ⚠️ Jatuh tempo terlewat
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-white rounded-xl p-1 shadow-sm">
          <Link
            href="/pelanggan/tagihan"
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation text-center ${activeTab === 'tagihan'
              ? 'bg-sky-500 text-white'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            Tagihan Aktif
          </Link>
          <Link
            href="/pelanggan/tagihan?tab=riwayat"
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation text-center ${activeTab === 'riwayat'
              ? 'bg-sky-500 text-white'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            Riwayat
          </Link>
        </div>

        {/* Content */}
        {lastRefreshTime && (
          <div className="mb-2 text-center">
            <span className="text-xs text-gray-500">
              Terakhir diperbarui: {lastRefreshTime.toLocaleTimeString('id-ID')}
            </span>
          </div>
        )}
        {activeTab === 'tagihan' ? (
          <div className="space-y-3">
            {/* Tombol Renew jika semua tagihan sudah lunas */}
            {semuaTagihanLunas && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Perpanjang Layanan
                    </h3>
                    <p className="text-sm text-gray-500">
                      Semua tagihan sudah lunas. Perpanjang layanan untuk periode berikutnya?
                    </p>
                    {renewDisabled && renewDisabledMessage && (
                      <p className="text-xs text-red-500 mt-2">
                        {renewDisabledMessage}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleRenew}
                    disabled={renewing || renewDisabled || checkingRenewStatus}
                    className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkingRenewStatus
                      ? 'Memeriksa...'
                      : renewing
                        ? 'Memproses...'
                        : renewDisabled
                          ? 'Dinonaktifkan'
                          : 'Perpanjang Layanan'}
                  </button>
                </div>
              </div>
            )}
            {tagihanList.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <HiOutlineDocumentText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Belum ada tagihan</p>
                <p className="text-xs text-gray-500">Tagihan akan muncul setelah di-generate oleh admin</p>
              </div>
            ) : tagihanAktif.length === 0 && !semuaTagihanLunas ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <HiOutlineCheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600">Tidak ada tagihan yang belum dibayar</p>
              </div>
            ) : tagihanAktif.length > 0 ? (
              tagihanAktif.map((tagihan) => (
                <div
                  key={tagihan.id}
                  className="bg-white rounded-xl shadow-sm p-5 active:scale-[0.98] transition-transform touch-manipulation"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {tagihan.bulan} {tagihan.tahun}
                      </h3>
                      <div className="text-sm text-gray-500">
                        <p>Jatuh Tempo: {pelanggan?.jatuhTempo ? formatDate(pelanggan.jatuhTempo) : formatDate(tagihan.jatuhTempo)}</p>
                        {pelanggan?.jatuhTempo && isDateOverdue(pelanggan.jatuhTempo) && tagihan.status === 'BELUM_LUNAS' && (
                          <p className="text-xs text-yellow-600 mt-1">
                            ⚠️ Jatuh tempo terlewat
                          </p>
                        )}
                        {pelanggan?.jatuhTempo && !areDatesSame(pelanggan.jatuhTempo, tagihan.jatuhTempo) && (
                          <p className="text-xs text-blue-600 mt-1">
                            📅 Periode tagihan: {formatDate(tagihan.jatuhTempo)}
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(tagihan.status)}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Tagihan</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatRupiah(tagihan.jumlah)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 transition-colors touch-manipulation active:scale-95">
                        Bayar Sekarang
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {riwayatBayar.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <HiOutlineDocumentText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Belum ada riwayat pembayaran</p>
              </div>
            ) : (
              riwayatBayar.map((tagihan) => (
                <div
                  key={tagihan.id}
                  className="bg-white rounded-xl shadow-sm p-5 active:scale-[0.98] transition-transform touch-manipulation"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {tagihan.bulan} {tagihan.tahun}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Dibayar: {tagihan.tanggalBayar ? formatDate(tagihan.tanggalBayar) : '-'}
                      </p>
                    </div>
                    {getStatusBadge(tagihan.status)}
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">Jumlah Pembayaran</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatRupiah(tagihan.jumlah)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-sky-500 touch-manipulation"
          >
            <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
              <HiOutlineDocumentText className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Tagihan</span>
          </Link>
          <Link
            href="/pelanggan/profil"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
          >
            <HiOutlineUser className="w-6 h-6" />
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

export default function TagihanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Memuat data...</div>
      </div>
    }>
      <TagihanContent />
    </Suspense>
  )
}
