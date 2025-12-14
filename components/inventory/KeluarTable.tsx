'use client'

import { useState, useEffect } from 'react'
import { FiEdit, FiTrash2, FiEye, FiPaperclip, FiCamera, FiCheckCircle, FiAlertTriangle, FiXCircle, FiMinusCircle, FiFileText, FiUser } from 'react-icons/fi'
import { getWithAuth, deleteWithAuth } from '@/lib/api-client'

interface BarangKeluar {
  id: string
  barangId: string
  gudangId: string
  jumlah: number
  kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
  isHilang?: boolean
  keterangan: string | null
  tanggal: string
  createdAt: string
  employeeId?: string | null
  purpose?: string | null
  fotoBukti: string[]
  fotoMetadata?: any
  barang: {
    id: string
    kode: string
    nama: string
    satuan: string
  }
  gudang: {
    id: string
    kode: string
    nama: string
  }
  user?: {
    id: string
    name: string | null
    email: string
  } | null
}

interface KeluarTableProps {
  onEdit?: (keluar: BarangKeluar) => void
  onView?: (keluar: BarangKeluar) => void
  refreshTrigger?: number
}

export function KeluarTable({ onEdit, onView, refreshTrigger = 0 }: KeluarTableProps) {
  const [keluarList, setKeluarList] = useState<BarangKeluar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // Fetch data
  useEffect(() => {
    async function fetchKeluarList() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20'
        })

        const response = await getWithAuth(`/api/inventory/keluar?${params}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Gagal memuat data')
        }

        setKeluarList(data.keluarList || [])
        setPagination(data.pagination || pagination)
      } catch (error) {
        console.error('Failed to fetch barang keluar:', error)
        setError(error instanceof Error ? error.message : 'Gagal memuat data')
      } finally {
        setLoading(false)
      }
    }

    fetchKeluarList()
  }, [page, refreshTrigger])

  const handleDelete = async (id: string, kode: string, jumlah: number) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus record barang keluar ${kode} (${jumlah} pcs)?\n\nPeringatan: Ini akan menambah stok barang kembali!`)) {
      return
    }

    try {
      const response = await deleteWithAuth(`/api/inventory/keluar/${id}`)

      if (!response.ok) {
        throw new Error('Gagal menghapus record barang keluar')
      }

      // Refresh data
      window.location.reload()
    } catch (error) {
      console.error('Failed to delete barang keluar:', error)
      alert('Gagal menghapus record barang keluar')
    }
  }

  return (
    <div className="overflow-x-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="min-w-full overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Tanggal
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Barang
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Gudang
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Jumlah
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Kondisi
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Keterangan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Diambil Oleh
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Foto
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            ) : keluarList.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                  Tidak ada data barang keluar
                </td>
              </tr>
            ) : (
              keluarList.map((keluar) => (
                <tr key={keluar.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(keluar.tanggal).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {keluar.barang.kode}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {keluar.barang.nama}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {keluar.gudang.kode}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {keluar.gudang.nama}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                      -{keluar.jumlah} {keluar.barang.satuan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${keluar.kondisi === 'BARU'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : keluar.kondisi === 'BEKAS'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        }`}>
                        {keluar.kondisi === 'BARU' && <><FiCheckCircle className="mr-1" /> Baru</>}
                        {keluar.kondisi === 'BEKAS' && <><FiAlertTriangle className="mr-1" /> Bekas</>}
                        {keluar.kondisi === 'RUSAK' && <><FiXCircle className="mr-1" /> Rusak</>}
                      </span>
                      {keluar.isHilang && (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                          <FiMinusCircle className="mr-1" /> HILANG
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {keluar.keterangan || '-'}
                      {keluar.purpose && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <FiFileText className="mr-1 inline" /> {keluar.purpose}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {keluar.user ? (
                      <div className="text-sm">
                        <div className="font-medium text-indigo-600 dark:text-indigo-400">
                          <FiUser className="mr-1 inline" /> {keluar.user.name || 'Unknown'}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {keluar.user.email}
                        </div>
                        {keluar.purpose && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            <FiFileText className="mr-1 inline" /> {keluar.purpose}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">Admin</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {keluar.fotoBukti && keluar.fotoBukti.length > 0 ? (
                      <div className="flex items-center justify-center space-x-1">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          <FiPaperclip className="h-3 w-3 mr-1" />
                          {keluar.fotoBukti.length}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">
                        <FiCamera className="h-4 w-4" />
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onView?.(keluar)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Lihat Detail"
                      >
                        <FiEye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onEdit?.(keluar)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        title="Edit"
                      >
                        <FiEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(keluar.id, keluar.barang.kode, keluar.jumlah)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Hapus"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Menampilkan {((page - 1) * pagination.limit) + 1} hingga{' '}
            {Math.min(page * pagination.limit, pagination.total)} dari{' '}
            {pagination.total} data
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}