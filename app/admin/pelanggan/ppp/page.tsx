"use client"

import { useEffect, useState } from 'react'
import { HiOutlinePlus, HiPencil, HiTrash, HiArrowPath, HiPrinter, HiArrowPathRoundedSquare, HiOutlineCalendar, HiOutlineExclamationTriangle } from 'react-icons/hi2'
import Link from 'next/link'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'

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
      // Tambahkan cache busting dengan timestamp
      const res = await fetch('/api/pelanggan-ppp', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      if (!res.ok) {
        throw new Error('Gagal memuat data pelanggan PPP')
      }

      let data = []
      try {
        const text = await res.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.error('Error parsing JSON:', e)
        // If parsing fails but response was OK, it might be empty body which is fine for empty list
        data = []
      }

      // Debug: Log data yang diterima
      // Debug: Log data yang diterima
      console.log('[Frontend] Data pelanggan diterima:', data.length, 'pelanggan')
      if (data.length > 0) {
        console.log('[Frontend] Sample pelanggan:', {
          id: data[0].id,
          idPelanggan: data[0].idPelanggan,
          nama: data[0].nama
        })
      }
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
      // Debug: Log ID yang akan dikirim
      console.log('[Frontend] Menghapus pelanggan dengan ID:', id, 'Type:', typeof id)

      const res = await fetch(`/api/pelanggan-ppp/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json()
        console.error('[Frontend] Error response:', errorData)
        throw new Error(errorData.error || 'Gagal menghapus pelanggan')
      }
      const result = await res.json()
      console.log('[Frontend] Delete berhasil:', result)
      await loadData()
    } catch (err: any) {
      console.error('[Frontend] Error saat menghapus:', err)
      alert(err.message || 'Terjadi kesalahan saat menghapus data')
    }
  }

  const handleRenewal = (id: string) => {
    // Redirect ke halaman renewal admin
    window.location.href = `/admin/pelanggan/ppp/${id}/renew`
  }

  const handlePrint = (id: string) => {
    // Buka halaman print tagihan di tab baru
    window.open(`/admin/pelanggan/ppp/${id}/print`, '_blank')
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
    return <PageLoader />
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
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Renew | Print
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {pelanggans.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Belum ada data pelanggan PPP
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Klik &quot;Tambah Pelanggan&quot; untuk menambahkan pelanggan baru
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
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pelanggan.tipe === 'REGULER'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                          }`}
                      >
                        {pelanggan.tipe === 'REGULER' ? (
                          <span className="flex items-center gap-1"><HiOutlineCalendar className="w-3 h-3" /> Reguler</span>
                        ) : (
                          <span className="flex items-center gap-1"><HiArrowPath className="w-3 h-3" /> Non Reguler</span>
                        )}
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
                          <div className="flex items-center gap-1">
                            <HiOutlineExclamationTriangle className="w-3 h-3" /> Jatuh Tempo
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={pelanggan.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleRenewal(pelanggan.id)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium inline-flex items-center justify-center w-10 h-10 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          title="Perpanjang Layanan"
                        >
                          <HiArrowPathRoundedSquare className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handlePrint(pelanggan.id)}
                          className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium inline-flex items-center justify-center w-10 h-10 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                          title="Print Tagihan"
                        >
                          <HiPrinter className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/admin/pelanggan/ppp/${pelanggan.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium inline-flex items-center justify-center w-10 h-10 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                          title="Edit"
                        >
                          <HiPencil className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(pelanggan.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium inline-flex items-center justify-center w-10 h-10 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Hapus"
                        >
                          <HiTrash className="w-5 h-5" />
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
