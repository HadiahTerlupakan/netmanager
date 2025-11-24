"use client"

import { useEffect, useState } from 'react'
import {
  HiOutlinePlus,
  HiArrowPath,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
} from 'react-icons/hi2'
import { StatusBadge } from '@/components/common/StatusBadge'

type Tagihan = {
  id: string
  noTagihan: string
  pelangganId: string
  periodeBulan: number
  periodeTahun: number
  subtotal: number
  diskon: number
  ppn: number
  biayaInstalasi: number
  biayaSewaPerangkat: number
  biayaLainnya: number
  total: number
  status: 'BELUM_LUNAS' | 'LUNAS' | 'TERLAMBAT'
  jatuhTempo: string
  tanggalBayar: string | null
  metodePembayaran: string | null
  createdAt: string
  pelanggan?: {
    id: string
    idPelanggan: string
    nama: string
    tipe: 'REGULER' | 'NON_REGULER'
  } | null
}

const namaBulan = [
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
]

export default function TagihanPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tagihans, setTagihans] = useState<Tagihan[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    periodeBulan: new Date().getMonth() + 1,
    periodeTahun: new Date().getFullYear(),
  })

  useEffect(() => {
    loadData()
  }, [filterStatus])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const url =
        filterStatus === 'all'
          ? '/api/tagihan'
          : `/api/tagihan?status=${filterStatus}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error('Gagal memuat data tagihan')
      }
      const data = await res.json()
      setTagihans(data || [])
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      const res = await fetch('/api/tagihan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          periodeBulan: generateForm.periodeBulan,
          periodeTahun: generateForm.periodeTahun,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal generate tagihan')
      }

      const result = await res.json()
      alert(
        `Tagihan berhasil digenerate!\nBerhasil: ${result.success}\nGagal: ${result.failed}`,
      )
      setShowGenerateModal(false)
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat generate tagihan')
    } finally {
      setGenerating(false)
    }
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
      month: 'short',
      day: 'numeric',
    })
  }

  const filteredTagihans = tagihans.filter((tagihan) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        tagihan.noTagihan.toLowerCase().includes(query) ||
        tagihan.pelangganId.toLowerCase().includes(query) ||
        tagihan.pelanggan?.nama.toLowerCase().includes(query) ||
        tagihan.pelanggan?.idPelanggan.toLowerCase().includes(query)
      )
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <HiArrowPath className="w-5 h-5 animate-spin" />
          <span>Memuat data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tagihan</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Kelola tagihan pelanggan (Auto-generate hanya untuk pelanggan REGULER)
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Generate Tagihan
        </button>
      </div>

      {/* Filter dan Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor tagihan atau ID pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <HiOutlineFunnel className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="BELUM_LUNAS">Belum Lunas</option>
              <option value="LUNAS">Lunas</option>
              <option value="TERLAMBAT">Terlambat</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  No Tagihan
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Periode
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Pelanggan
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Subtotal
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Diskon
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  PPN
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Jatuh Tempo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Tanggal Bayar
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTagihans.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada data tagihan
                  </td>
                </tr>
              ) : (
                filteredTagihans.map((tagihan) => (
                  <tr
                    key={tagihan.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {tagihan.noTagihan}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {namaBulan[tagihan.periodeBulan - 1]} {tagihan.periodeTahun}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {tagihan.pelanggan?.nama || tagihan.pelangganId}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {tagihan.pelanggan?.idPelanggan || tagihan.pelangganId}
                        </div>
                        {tagihan.pelanggan?.tipe && (
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                tagihan.pelanggan.tipe === 'REGULER'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                              }`}
                            >
                              {tagihan.pelanggan.tipe === 'REGULER' ? '📅 Reguler' : '🔄 Non Reguler'}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatRupiah(tagihan.subtotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatRupiah(tagihan.diskon)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatRupiah(tagihan.ppn)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                      {formatRupiah(tagihan.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(tagihan.jatuhTempo)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={
                          tagihan.status === 'LUNAS'
                            ? 'AKTIF'
                            : tagihan.status === 'TERLAMBAT'
                              ? 'MAINTENANCE'
                              : 'NONAKTIF'
                        }
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {tagihan.tanggalBayar ? formatDate(tagihan.tanggalBayar) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Generate Tagihan Bulanan
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Periode Bulan
                </label>
                <select
                  value={generateForm.periodeBulan}
                  onChange={(e) =>
                    setGenerateForm({
                      ...generateForm,
                      periodeBulan: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {namaBulan.map((bulan, index) => (
                    <option key={index} value={index + 1}>
                      {bulan}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Periode Tahun
                </label>
                <input
                  type="number"
                  value={generateForm.periodeTahun}
                  onChange={(e) =>
                    setGenerateForm({
                      ...generateForm,
                      periodeTahun: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={generating}
              >
                Batal
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

