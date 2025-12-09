'use client'

import { useState, useEffect } from 'react'
import {
  HiOutlineCube,
  HiOutlineMagnifyingGlass,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlinePhoto,
  HiOutlineArchiveBox
} from 'react-icons/hi2'
import Link from 'next/link'

interface InventoryItem {
  id: string
  barang: {
    id: string
    kode: string
    nama: string
    satuan: string
    stockPerGudang: Array<{
      gudangId: string
      gudang: {
        id: string
        kode: string
        nama: string
        lokasi?: string
      }
      stok: number
    }>
  }
  lastUpdated: string
}

export default function EmployeeInventoryItems() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGudang, setSelectedGudang] = useState('')
  const [gudangs, setGudangs] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchInventoryItems()
    fetchGudangs()
  }, [currentPage, searchTerm, selectedGudang])

  const fetchInventoryItems = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedGudang && { gudangId: selectedGudang })
      })

      const response = await fetch(`/api/inventory/barang?${params}`)
      if (!response.ok) {
        throw new Error('Gagal memuat data inventaris')
      }

      const data = await response.json()
      setItems(data.barangs || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Error fetching inventory items:', error)
      setError('Gagal memuat data inventaris')
    } finally {
      setLoading(false)
    }
  }

  const fetchGudangs = async () => {
    try {
      const response = await fetch('/api/inventory/gudang')
      if (response.ok) {
        const data = await response.json()
        setGudangs(data.gudangs || [])
      }
    } catch (error) {
      console.error('Error fetching gudangs:', error)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus barang ini?')) {
      return
    }

    try {
      const response = await fetch(`/api/inventory/barang/${itemId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Gagal menghapus barang')
      }

      // Refresh items
      fetchInventoryItems()
    } catch (error) {
      console.error('Error deleting item:', error)
      setError('Gagal menghapus barang')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'text-red-600 font-bold'
    if (stock < 5) return 'text-yellow-600 font-semibold'
    return 'text-green-600'
  }

  const getStockStatusText = (stock: number) => {
    if (stock === 0) return 'Stok Kosong'
    if (stock < 5) return 'Stok Menipis'
    return 'Stok Aman'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HiOutlineArchiveBox className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Inventaris Barang</h1>
              <p className="text-blue-100">
                Kelola data inventaris barang kantor
              </p>
            </div>
          </div>
          <Link
            href="/employee/inventory"
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            ← Kembali
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari barang berdasarkan nama atau kode..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedGudang}
              onChange={(e) => {
                setSelectedGudang(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Semua Gudang</option>
              {gudangs.map((gudang) => (
                <option key={gudang.id} value={gudang.id}>
                  {gudang.kode} - {gudang.nama}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <HiOutlineCube className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'Tidak ada barang yang cocok' : 'Belum ada data inventaris'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Coba uba kata kunci pencarian' : 'Tambahkan barang pertama untuk memulai'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <div key={item.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {item.barang?.nama || 'Nama Barang Tidak Tersedia'}
                      </h3>
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded">
                        {item.barang?.kode || 'Kode Tidak Tersedia'}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Satuan: {item.barang?.satuan || 'Tidak Tersedia'}
                      </p>
                    </div>

                    {/* Stock Information per Gudang */}
                    {item.barang?.stockPerGudang && item.barang.stockPerGudang.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Stok per Gudang:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {item.barang.stockPerGudang.map((stock) => (
                            <div key={stock.gudangId} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {stock.gudang?.kode} - {stock.gudang?.nama}
                                </span>
                                <span className={`text-sm font-medium ${getStockStatusColor(stock.stok)}`}>
                                  {stock.stok} {item.barang?.satuan || 'Satuan Tidak Tersedia'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {stock.gudang?.lokasi && `Lokasi: ${stock.gudang.lokasi}`}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Status: {getStockStatusText(stock.stok)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Terakhir update: {formatDate(item.lastUpdated)}
                    </div>
                  </div>

                  <div className="ml-4 flex items-center gap-2">
                    <Link
                      href={`/employee/inventory/inventory-items/${item.id}`}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <HiOutlineMagnifyingGlass className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <HiOutlineTrash className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="fixed bottom-6 right-6">
        <Link
          href="/employee/inventory/inventory-items/new"
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Tambah Barang
        </Link>
      </div>
    </div>
  )
}
