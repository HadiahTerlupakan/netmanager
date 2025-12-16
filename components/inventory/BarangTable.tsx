'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FiEdit, FiTrash2, FiEye, FiSearch, FiLayers } from 'react-icons/fi'

interface Barang {
  id: string
  kode: string
  nama: string
  satuan: string
  totalStock: number
  stockPerGudang: Array<{
    gudangId: string
    gudangKode: string
    gudangNama: string
    stok: number
  }>
  createdAt: string
  updatedAt: string
}

import { useSocketEvent } from '@/hooks/useSocket'

export function BarangTable() {
  const [barangs, setBarangs] = useState<Barang[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [gudangId, setGudangId] = useState('')
  const [gudangs, setGudangs] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  // Listen for inventory updates
  useSocketEvent('inventory:update', () => {
    fetchBarangs()
  })

  // Fetch gudangs for filter
  useEffect(() => {
    async function fetchGudangs() {
      try {
        const response = await fetch('/api/inventory/gudang')
        const data = await response.json()
        setGudangs(data.gudangs || [])
      } catch (error) {
        console.error('Failed to fetch gudangs:', error)
      }
    }

    fetchGudangs()
  }, [])

  // Fetch barang data
  const fetchBarangs = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(gudangId && { gudangId })
      })

      const response = await fetch(`/api/inventory/barang?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memuat data')
      }

      setBarangs(data.barangs || [])
      setPagination(data.pagination || pagination)
    } catch (error) {
      console.error('Failed to fetch barang:', error)
      setError(error instanceof Error ? error.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBarangs()
  }, [search, gudangId, page])

  const handleDelete = async (id: string, kode: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus barang ${kode}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/inventory/barang/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menghapus barang')
      }

      // Show success message
      alert('Barang berhasil dihapus')

      // Refresh data
      window.location.reload()
    } catch (error) {
      console.error('Failed to delete barang:', error)
      alert(error instanceof Error ? error.message : 'Gagal menghapus barang')
    }
  }

  return (
    <div className="overflow-x-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex-1 min-w-[200px] relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari barang..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div className="min-w-[150px]">
          <select
            value={gudangId}
            onChange={(e) => {
              setGudangId(e.target.value)
              setPage(1)
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Semua Gudang</option>
            {gudangs.map((gudang: any) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="min-w-full overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Kode
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Nama Barang
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Satuan
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Total Stok
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Stok per Gudang
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Update
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            ) : barangs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Tidak ada data barang
                </td>
              </tr>
            ) : (
              barangs.map((barang) => (
                <tr key={barang.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {barang.kode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {barang.nama}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      {barang.satuan}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${barang.totalStock === 0
                      ? 'bg-red-100 text-red-800'
                      : barang.totalStock < 5
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                      }`}>
                      {barang.totalStock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-xs">
                      {barang.stockPerGudang.length === 0 ? (
                        <span className="text-sm text-gray-500 italic">Tidak ada stok</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {barang.stockPerGudang.slice(0, 3).map((stock) => (
                            <div
                              key={stock.gudangId}
                              className="inline-flex items-center"
                              title={`${stock.gudangNama}: ${stock.stok}`}
                            >
                              <span className="text-xs text-gray-600 dark:text-gray-400 mr-1">
                                {stock.gudangKode}:
                              </span>
                              <span
                                className={`px-1.5 py-0.5 text-xs rounded ${stock.stok === 0
                                  ? 'bg-red-100 text-red-800'
                                  : stock.stok < 5
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                  }`}
                              >
                                {stock.stok}
                              </span>
                            </div>
                          ))}
                          {barang.stockPerGudang.length > 3 && (
                            <span className="text-xs text-gray-500 italic">
                              +{barang.stockPerGudang.length - 3} lagi
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    {new Date(barang.updatedAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center space-x-1">
                      <Link
                        href={`/admin/inventory/barang/${barang.id}`}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                        title="Detail"
                      >
                        <FiEye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/admin/inventory/barang/${barang.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
                        title="Edit"
                      >
                        <FiEdit className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(barang.id, barang.kode)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1"
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