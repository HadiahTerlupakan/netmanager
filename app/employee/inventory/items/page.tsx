'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  HiOutlineMagnifyingGlass,
  HiOutlineCube,
  HiOutlineBuildingOffice,
  HiOutlineArrowLeft,
  HiOutlinePlus
} from 'react-icons/hi2'

export default function ItemsPage() {
  const [barangs, setBarangs] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBarangs() {
      try {
        const response = await fetch('/api/inventory/barang?limit=200')
        const data = await response.json()
        setBarangs(data.barangs || [])
      } catch (error) {
        console.error('Error fetching items:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBarangs()
  }, [])

  const filteredBarangs = barangs.filter(barang =>
    barang.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    barang.nama.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getTotalStock = (barang: any) => {
    if (!barang.stockPerGudang || barang.stockPerGudang.length === 0) return 0
    return barang.stockPerGudang.reduce((total: number, stock: any) => total + stock.stok, 0)
  }

  const getAvailableWarehouses = (barang: any) => {
    if (!barang.stockPerGudang || barang.stockPerGudang.length === 0) return []
    return barang.stockPerGudang.filter((stock: any) => stock.stok > 0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/employee/inventory"
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <HiOutlineArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Cari Barang
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cek stok dan pilih barang yang akan diambil
            </p>
          </div>
        </div>
        <Link
          href="/employee/inventory"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Ambil Barang
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari kode atau nama barang..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-colors"
          />
        </div>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data barang...</p>
        </div>
      ) : filteredBarangs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <HiOutlineCube className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm ? 'Tidak ada barang yang ditemukan' : 'Belum ada data barang'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBarangs.map((barang) => {
            const totalStock = getTotalStock(barang)
            const availableWarehouses = getAvailableWarehouses(barang)

            return (
              <div
                key={barang.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                        {barang.kode}
                      </span>
                      {totalStock === 0 && (
                        <span className="text-xs bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded">
                          Habis
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {barang.nama}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Satuan: {barang.satuan}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {totalStock}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Total Stok
                    </p>
                  </div>
                </div>

                {/* Available Warehouses */}
                {availableWarehouses.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <HiOutlineBuildingOffice className="w-4 h-4" />
                      Tersedia di:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableWarehouses.map((stock: any) => (
                        <div
                          key={stock.gudangId}
                          className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"
                        >
                          <div>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {stock.gudangKode}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {stock.gudangNama}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {stock.stok}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {barang.satuan}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-xs text-red-800 dark:text-red-200">
                      Stok habis di semua gudang
                    </p>
                  </div>
                )}

                {/* Quick Action */}
                {totalStock > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <Link
                      href={`/employee/inventory?barangId=${barang.id}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      <HiOutlinePlus className="w-4 h-4" />
                      Ambil Barang Ini
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {!loading && filteredBarangs.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Menampilkan <span className="font-semibold">{filteredBarangs.length}</span> dari{' '}
            <span className="font-semibold">{barangs.length}</span> barang
            {searchTerm && ` untuk "${searchTerm}"`}
          </p>
        </div>
      )}
    </div>
  )
}