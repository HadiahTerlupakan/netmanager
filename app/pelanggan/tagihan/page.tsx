"use client"

import { useEffect, useState, Suspense, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getWithExpiry } from '@/lib/utils/storage-with-expiry'
import {
  HiOutlineCreditCard,
  HiOutlineDocumentText,
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineXCircle,
  HiArrowPath,
  HiArrowDownTray,
} from 'react-icons/hi2'
import Link from 'next/link'
import { EmptyBills, AllBillsPaid, EmptyPaymentHistory } from '@/components/pelanggan/EmptyStates'
import { SkeletonBillingCard } from '@/components/pelanggan/LoadingStates'

type TagihanItem = {
  id: string
  bulan: string
  tahun: number
  jumlah: number
  total: number
  jatuhTempo: string
  status: 'LUNAS' | 'BELUM_LUNAS' | 'TERLAMBAT'
  tanggalBayar?: string
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const

function TagihanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'tagihan'
  const [loading, setLoading] = useState(true)
  const [pelanggan, setPelanggan] = useState<any>(null)
  const [tagihanList, setTagihanList] = useState<TagihanItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const isRefreshingRef = useRef(false)

  const fetchTagihan = useCallback(async (showLoading = true, forceRefresh = false) => {
    if (isRefreshingRef.current && !forceRefresh) {
      return
    }

    const token = localStorage.getItem('pelanggan_token')
    const pelangganData = getWithExpiry<any>('pelanggan_data')

    if (!token || !pelangganData) {
      router.push('/pelanggan/login')
      return
    }

    try {
      const data = pelangganData
      if (showLoading) setLoading(true)
      isRefreshingRef.current = true

      const cacheBuster = forceRefresh ? `?_t=${Date.now()}` : ''
      const response = await fetch(`/api/tagihan/pelanggan/${data.id}${cacheBuster}`, {
        cache: forceRefresh ? 'no-store' : 'default',
        headers: {
          'x-pelanggan-token': token,
        },
      })

      if (!response.ok) {
        throw new Error(`Gagal mengambil data tagihan`)
      }

      const tagihans = await response.json()

      const transformedTagihans: TagihanItem[] = tagihans.map((tagihan: any) => ({
        id: tagihan.id,
        bulan: NAMA_BULAN[tagihan.periodeBulan - 1],
        tahun: tagihan.periodeTahun,
        jumlah: tagihan.jumlah || tagihan.total,
        total: tagihan.total,
        jatuhTempo: tagihan.jatuhTempo,
        status: tagihan.status,
        tanggalBayar: tagihan.tanggalBayar || undefined,
      }))

      setTagihanList(transformedTagihans)
      setLastRefreshTime(new Date())
    } catch (err: any) {
      console.error('Error fetching tagihan:', err)
      setError(err.message || 'Gagal mengambil data tagihan')
    } finally {
      if (showLoading) setLoading(false)
      isRefreshingRef.current = false
    }
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem('pelanggan_token')
    const pelangganData = getWithExpiry<any>('pelanggan_data')

    if (!token || !pelangganData) {
      router.push('/pelanggan/login')
      return
    }

    try {
      const data = pelangganData
      setPelanggan(data)
      fetchTagihan()

      const intervalId = setInterval(() => fetchTagihan(false, false), 30000)
      const handleFocus = () => fetchTagihan(false, true)
      const handleVisibilityChange = () => {
        if (!document.hidden) fetchTagihan(false, true)
      }

      window.addEventListener('focus', handleFocus)
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        clearInterval(intervalId)
        window.removeEventListener('focus', handleFocus)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    } catch (err) {
      console.error('Error loading pelanggan data:', err)
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
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      LUNAS: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
      BELUM_LUNAS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
      TERLAMBAT: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    }
    const labels = {
      LUNAS: 'Lunas',
      BELUM_LUNAS: 'Belum Lunas',
      TERLAMBAT: 'Terlambat',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const tagihanAktif = tagihanList.filter(t => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT')
  const riwayat = tagihanList.filter(t => t.status === 'LUNAS')

  const handleDownloadInvoice = async (tagihanId: string) => {
    try {
      const token = localStorage.getItem('pelanggan_token')
      const response = await fetch(`/api/tagihan/${tagihanId}/pdf`, {
        headers: {
          'x-pelanggan-token': token || '',
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${tagihanId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error('Error downloading invoice:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tagihan</h1>
          </div>
        </div>
        <main className="px-4 py-6 md:px-6 lg:px-8 max-w-5xl mx-auto">
          <SkeletonBillingCard />
          <SkeletonBillingCard />
        </main>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tagihan</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Kelola tagihan dan pembayaran Anda</p>
              </div>
              <button
                onClick={() => fetchTagihan(false, true)}
                disabled={loading || refreshing}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 relative"
                title="Refresh"
              >
                <HiArrowPath className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
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

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <Link
              href="/pelanggan/tagihan?tab=tagihan"
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'tagihan'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              Tagihan Aktif ({tagihanAktif.length})
            </Link>
            <Link
              href="/pelanggan/tagihan?tab=riwayat"
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'riwayat'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              Riwayat ({riwayat.length})
            </Link>
          </div>

          {/* Tab Content */}
          {activeTab === 'tagihan' && (
            <div className="space-y-4">
              {tagihanAktif.length === 0 && riwayat.length > 0 ? (
                <AllBillsPaid />
              ) : tagihanAktif.length === 0 ? (
                <EmptyBills />
              ) : (
                tagihanAktif.map((tagihan) => (
                  <div
                    key={tagihan.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {tagihan.bulan} {tagihan.tahun}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Jatuh tempo: {formatDate(tagihan.jatuhTempo)}
                        </p>
                      </div>
                      {getStatusBadge(tagihan.status)}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Tagihan</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatRupiah(tagihan.total)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownloadInvoice(tagihan.id)}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                        >
                          <HiArrowDownTray className="w-4 h-4" />
                          <span className="hidden sm:inline">Invoice</span>
                        </button>
                        <Link
                          href={`/pelanggan/tagihan/${tagihan.id}/bayar`}
                          className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors font-medium"
                        >
                          Bayar Sekarang
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'riwayat' && (
            <div className="space-y-4">
              {riwayat.length === 0 ? (
                <EmptyPaymentHistory />
              ) : (
                riwayat.map((tagihan) => (
                  <div
                    key={tagihan.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {tagihan.bulan} {tagihan.tahun}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Dibayar: {tagihan.tanggalBayar ? formatDate(tagihan.tanggalBayar) : '-'}
                        </p>
                      </div>
                      {getStatusBadge(tagihan.status)}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatRupiah(tagihan.total)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownloadInvoice(tagihan.id)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                      >
                        <HiArrowDownTray className="w-4 h-4" />
                        Download Invoice
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </>
  )
}

export default function TagihanPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading...</div>}>
      <TagihanContent />
    </Suspense>
  )
}
