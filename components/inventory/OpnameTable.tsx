'use client'

import { useState, useEffect, useCallback } from 'react'
import { FiEdit2, FiTrash2, FiEye, FiMinusCircle } from 'react-icons/fi'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { getWithAuth, deleteWithAuth } from '@/lib/api-client'

interface StockOpnameRecord {
  id: string
  barangId: string
  gudangId: string
  stokFisik: number
  stokSistem: number
  selisih: number
  keterangan: string | null
  kondisiBaik: number
  kondisiRusak: number
  kondisiExpire: number
  lokasiPenyimpanan: string | null
  nomorRak: string | null
  nomorBox: string | null
  pic: string | null
  suhuPenyimpanan: number | null
  kelembaban: number | null
  tanggalExpire: Date | null
  nomorBatch: string | null
  catatanDetail: string | null
  createdAt: string
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
}

interface OpnameTableProps {
  onEdit?: (opname: StockOpnameRecord) => void
  onView?: (opname: StockOpnameRecord) => void
  refreshTrigger?: number
}

export function OpnameTable({ onEdit, onView, refreshTrigger = 0 }: OpnameTableProps) {
  const [opnameList, setOpnameList] = useState<StockOpnameRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    barangId: '',
    gudangId: '',
    search: ''
  })
  const [barangs, setBarangs] = useState<{ id: string; kode: string; nama: string }[]>([])
  const [gudangs, setGudangs] = useState<{ id: string; kode: string; nama: string }[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const limit = 20

  const fetchBarangsAndGudangs = useCallback(async () => {
    try {
      const [barangRes, gudangRes] = await Promise.all([
        getWithAuth('/api/inventory/barang?limit=100'),
        getWithAuth('/api/inventory/gudang')
      ])

      if (barangRes.ok) {
        const barangData = await barangRes.json()
        const barangResult = barangData.data || barangData
        setBarangs(Array.isArray(barangResult.barangs) ? barangResult.barangs : (Array.isArray(barangResult) ? barangResult : []))
      } else {
        setBarangs([])
      }

      if (gudangRes.ok) {
        const gudangData = await gudangRes.json()
        const gudangResult = gudangData.data || gudangData
        setGudangs(Array.isArray(gudangResult.gudangs) ? gudangResult.gudangs : (Array.isArray(gudangResult) ? gudangResult : []))
      } else {
        setGudangs([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setBarangs([])
      setGudangs([])
    }
  }, [])

  const fetchOpnameList = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(filters.barangId && { barangId: filters.barangId }),
        ...(filters.gudangId && { gudangId: filters.gudangId })
      })

      const response = await getWithAuth(`/api/inventory/opname/list?${params}`)
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal memuat data stock opname')
      }

      const data = await response.json()
      const result = data.data || data
      setOpnameList(result.opnameList || [])
      setTotalPages(result.pagination?.totalPages || 0)
      setTotal(result.pagination?.total || 0)
    } catch (error) {
      console.error('Error fetching opname list:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }, [currentPage, filters.barangId, filters.gudangId])

  useEffect(() => {
    fetchBarangsAndGudangs()
  }, [fetchBarangsAndGudangs])

  useEffect(() => {
    fetchOpnameList()
  }, [fetchOpnameList, refreshTrigger])

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus record stock opname ini? Stok akan dikembalikan ke nilai sistem sebelum opname.')) {
      return
    }

    setDeletingId(id)
    try {
      const response = await deleteWithAuth(`/api/inventory/opname/${id}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menghapus stock opname')
      }

      await fetchOpnameList()
    } catch (error) {
      console.error('Error deleting stock opname:', error)
      alert(error instanceof Error ? error.message : 'Gagal menghapus stock opname')
    } finally {
      setDeletingId(null)
    }
  }

  const getSelisihBadge = (selisih: number) => {
    if (selisih === 0) {
      return { color: 'bg-green-100 text-green-800', text: 'Tidak ada selisih' }
    } else if (selisih > 0) {
      return { color: 'bg-blue-100 text-blue-800', text: `+${selisih} (lebih)` }
    } else {
      return { color: 'bg-red-100 text-red-800', text: `${selisih} (kurang)` }
    }
  }

  const getQualityBadge = (baik: number, rusak: number, bekas: number) => {
    const total = baik + rusak + bekas
    if (total === 0) return null
    const persentase = (baik / total) * 100

    if (persentase >= 95) {
      return { color: 'bg-green-100 text-green-800', text: 'Sangat Baik' }
    } else if (persentase >= 85) {
      return { color: 'bg-yellow-100 text-yellow-800', text: 'Baik' }
    } else {
      return { color: 'bg-red-100 text-red-800', text: 'Buruk' }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const columns: Column<StockOpnameRecord>[] = [
    {
      key: 'createdAt',
      header: 'Tanggal',
      priority: 'secondary',
      render: (opname) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {formatDate(opname.createdAt)}
        </div>
      )
    },
    {
      key: 'barang',
      header: 'Barang',
      priority: 'primary',
      render: (opname) => (
        <>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {opname.barang.kode}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {opname.barang.nama}
          </div>
        </>
      )
    },
    {
      key: 'gudang',
      header: 'Gudang',
      priority: 'secondary',
      render: (opname) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {opname.gudang.nama}
        </div>
      )
    },
    {
      key: 'stokSistem',
      header: 'Stok Sistem',
      priority: 'tertiary',
      render: (opname) => (
        <div className="text-center">
            <span className="text-sm font-medium text-blue-600">
                {opname.stokSistem}
            </span>
        </div>
      )
    },
    {
      key: 'stokFisik',
      header: 'Stok Fisik',
      priority: 'primary',
      render: (opname) => (
        <div className="text-center">
            <span className="text-sm font-bold text-green-600">
                {opname.stokFisik}
            </span>
        </div>
      )
    },
    {
      key: 'kondisi',
      header: 'Kondisi (B/R/BKS)',
      priority: 'secondary',
      render: (opname) => {
        const qualityBadge = getQualityBadge(opname.kondisiBaik, opname.kondisiRusak, opname.kondisiExpire)
        return (
            <div className="text-xs space-y-1">
                <div className="flex justify-center space-x-2">
                <span className="text-green-600">{opname.kondisiBaik}</span>
                <span className="text-red-600">{opname.kondisiRusak}</span>
                <span className="text-orange-600">{opname.kondisiExpire}</span>
                </div>
                {qualityBadge && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                    <FiMinusCircle className="w-3 h-3" /> HILANG
                </span>
                )}
            </div>
        )
      }
    },
    {
      key: 'selisih',
      header: 'Selisih',
      priority: 'primary',
      render: (opname) => {
          const selisihBadge = getSelisihBadge(opname.selisih)
          return (
            <div className="text-center">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selisihBadge.color}`}>
                {selisihBadge.text}
                </span>
            </div>
          )
      }
    },
    {
      key: 'pic',
      header: 'PIC',
      priority: 'tertiary',
      render: (opname) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {opname.pic || '-'}
        </div>
      )
    }
  ]

  const renderActions = (opname: StockOpnameRecord) => (
    <div className="flex items-center justify-center gap-2">
        {onView && (
        <button
            onClick={() => onView(opname)}
            className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Detail"
        >
            <FiEye className="h-4 w-4" />
        </button>
        )}
        {onEdit && (
        <button
            onClick={() => onEdit(opname)}
            className="p-2 text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:text-yellow-300 dark:hover:bg-yellow-900/20 rounded transition-colors"
            title="Edit"
        >
            <FiEdit2 className="h-4 w-4" />
        </button>
        )}
        <button
        onClick={() => handleDelete(opname.id)}
        disabled={deletingId === opname.id}
        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
        title="Delete"
        >
        <FiTrash2 className="h-4 w-4" />
        </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Barang
            </label>
            <select
              value={filters.barangId}
              onChange={(e) => setFilters({ ...filters, barangId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Semua Barang</option>
              {barangs.map((barang) => (
                <option key={barang.id} value={barang.id}>
                  {barang.kode} - {barang.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gudang
            </label>
            <select
              value={filters.gudangId}
              onChange={(e) => setFilters({ ...filters, gudangId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Semua Gudang</option>
              {gudangs.map((gudang) => (
                <option key={gudang.id} value={gudang.id}>
                  {gudang.kode} - {gudang.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={() => setFilters({ barangId: '', gudangId: '', search: '' })}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Laporan Stock Opname
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total {total} record
          </span>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchOpnameList}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : (
            <ResponsiveTable
                data={opnameList}
                columns={columns}
                keyField="id"
                loading={loading}
                emptyMessage="Belum ada data stock opname"
                loadingMessage="Memuat data..."
                renderActions={renderActions}
            />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
            <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6">
            <div className="flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                >
                    Previous
                </button>
                <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                >
                    Next
                </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                    Menampilkan <span className="font-medium">{(currentPage - 1) * limit + 1}</span> hingga{' '}
                    <span className="font-medium">{Math.min(currentPage * limit, total)}</span> dari{' '}
                    <span className="font-medium">{total}</span> hasil
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    >
                        Previous
                    </button>
                    {[...Array(totalPages)].map((_, i) => i + 1).map((page) => (
                        <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === page
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/20'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                            }`}
                        >
                        {page}
                        </button>
                    ))}
                    <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    >
                        Next
                    </button>
                    </nav>
                </div>
                </div>
            </div>
            </div>
        )}
      </div>
    </div>
  )
}