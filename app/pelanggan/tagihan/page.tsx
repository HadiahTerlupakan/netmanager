"use client"

import { useEffect, useState } from 'react'
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

export default function TagihanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'tagihan'
  const [loading, setLoading] = useState(true)
  const [pelanggan, setPelanggan] = useState<any>(null)

  // Dummy data tagihan
  const [tagihanList] = useState<TagihanItem[]>([
    {
      id: '1',
      bulan: 'November',
      tahun: 2025,
      jumlah: 150000,
      jatuhTempo: '2025-11-30',
      status: 'BELUM_LUNAS',
    },
    {
      id: '2',
      bulan: 'Oktober',
      tahun: 2025,
      jumlah: 150000,
      jatuhTempo: '2025-10-30',
      status: 'LUNAS',
      tanggalBayar: '2025-10-28',
    },
    {
      id: '3',
      bulan: 'September',
      tahun: 2025,
      jumlah: 150000,
      jatuhTempo: '2025-09-30',
      status: 'LUNAS',
      tanggalBayar: '2025-09-29',
    },
    {
      id: '4',
      bulan: 'Agustus',
      tahun: 2025,
      jumlah: 150000,
      jatuhTempo: '2025-08-30',
      status: 'LUNAS',
      tanggalBayar: '2025-08-28',
    },
  ])

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
    } catch (error) {
      console.error('Error parsing pelanggan data:', error)
      router.push('/pelanggan/login')
    } finally {
      setLoading(false)
    }
  }, [router])

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

  const tagihanAktif = tagihanList.filter((t) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT')
  const riwayatBayar = tagihanList.filter((t) => t.status === 'LUNAS')

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
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation">
              <HiBell className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-white rounded-xl p-1 shadow-sm">
          <Link
            href="/pelanggan/tagihan"
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation text-center ${
              activeTab === 'tagihan'
                ? 'bg-sky-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Tagihan Aktif
          </Link>
          <Link
            href="/pelanggan/tagihan?tab=riwayat"
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation text-center ${
              activeTab === 'riwayat'
                ? 'bg-sky-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Riwayat
          </Link>
        </div>

        {/* Content */}
        {activeTab === 'tagihan' ? (
          <div className="space-y-3">
            {tagihanAktif.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <HiOutlineCheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600">Tidak ada tagihan yang belum dibayar</p>
              </div>
            ) : (
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
                      <p className="text-sm text-gray-500">
                        Jatuh Tempo: {formatDate(tagihan.jatuhTempo)}
                      </p>
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
                    <button className="px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 transition-colors touch-manipulation active:scale-95">
                      Bayar Sekarang
                    </button>
                  </div>
                </div>
              ))
            )}
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
