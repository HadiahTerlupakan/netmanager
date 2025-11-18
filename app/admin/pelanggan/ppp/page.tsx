"use client"

import { useEffect, useState } from 'react'
import { HiOutlinePlus, HiPencil, HiTrash, HiArrowPath } from 'react-icons/hi2'
import Link from 'next/link'
import { StatusBadge } from '@/components/common/StatusBadge'

type PelangganPPP = {
  id: string
  idPelanggan: string
  nama: string
  username: string
  tipe: 'REGULER' | 'NON_REGULER'
  hargaPaketId: string
  hargaPaket?: {
    id: string
    name: string
    harga: number
  } | null
  tanggalAktif: string
  jatuhTempo: string
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  alamat?: string | null
  noTelp?: string | null
  email?: string | null
  createdAt: string
}

export default function PelangganPPPPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pelanggans, setPelanggans] = useState<PelangganPPP[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/pelanggan-ppp')
      if (!res.ok) {
        throw new Error('Gagal memuat data pelanggan PPP')
      }
      const data = await res.json()
      setPelanggans(data || [])
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pelanggan ini? Tindakan ini tidak dapat dibatalkan.')) {
      return
    }

    try {
      const res = await fetch(`/api/pelanggan-ppp/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal menghapus pelanggan')
      }
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menghapus data')
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

  const isJatuhTempo = (jatuhTempo: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const jatuhTempoDate = new Date(jatuhTempo)
    jatuhTempoDate.setHours(0, 0, 0, 0)
    return jatuhTempoDate < today
  }

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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pelanggan PPP</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Kelola data pelanggan yang menggunakan koneksi PPPoE
          </p>
        </div>
        <Link
          href="/admin/pelanggan/ppp/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Tambah Pelanggan
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  ID Pelanggan
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Nama
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Username PPPoE
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Paket
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Tanggal Aktif
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Jatuh Tempo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {pelanggans.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Belum ada data pelanggan PPP
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Klik "Tambah Pelanggan" untuk menambahkan pelanggan baru
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pelanggans.map((pelanggan, index) => (
                  <tr
                    key={pelanggan.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {pelanggan.idPelanggan}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {pelanggan.nama}
                      </div>
                      {pelanggan.email && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {pelanggan.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {pelanggan.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          pelanggan.tipe === 'REGULER'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}
                      >
                        {pelanggan.tipe === 'REGULER' ? '📅 Reguler' : '🔄 Non Reguler'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {pelanggan.hargaPaket?.name || '-'}
                      </div>
                      {pelanggan.hargaPaket && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatRupiah(pelanggan.hargaPaket.harga)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(pelanggan.tanggalAktif)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatDate(pelanggan.jatuhTempo)}
                      </div>
                      {isJatuhTempo(pelanggan.jatuhTempo) && (
                        <div className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                          ⚠️ Jatuh Tempo
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={pelanggan.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/pelanggan/ppp/${pelanggan.id}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1"
                        >
                          Lihat
                        </Link>
                        <Link
                          href={`/admin/pelanggan/ppp/${pelanggan.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                        >
                          <HiPencil className="w-4 h-4" />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(pelanggan.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium inline-flex items-center gap-1"
                        >
                          <HiTrash className="w-4 h-4" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
