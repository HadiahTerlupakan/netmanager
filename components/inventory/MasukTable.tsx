'use client'

import { useState, useEffect } from 'react'
import { FiEdit, FiTrash2, FiEye, FiPaperclip, FiCamera, FiCheckCircle, FiAlertTriangle, FiXCircle, FiUser } from 'react-icons/fi'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'

interface BarangMasuk {
  id: string
  barangId: string
  gudangId: string
  jumlah: number
  kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
  keterangan: string | null
  tanggal: string
  createdAt: string
  employeeId?: string | null
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

interface MasukTableProps {
  onEdit?: ((masuk: BarangMasuk) => void) | undefined
  onView?: ((masuk: BarangMasuk) => void) | undefined
  refreshTrigger?: number
  search?: string
  startDate?: string
  endDate?: string
  siteId?: string
  gudangId?: string
}

export function MasukTable({
  onEdit,
  onView,
  refreshTrigger = 0,
  search = '',
  startDate = '',
  endDate = '',
  siteId = '',
  gudangId = ''
}: MasukTableProps) {
  const [masukList, setMasukList] = useState<BarangMasuk[]>([])
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
    async function fetchMasukList() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20'
        })

        if (search) params.append('search', search)
        if (startDate) params.append('startDate', new Date(startDate).toISOString())
        if (endDate) params.append('endDate', new Date(endDate).toISOString())
        if (siteId) params.append('siteId', siteId)
        if (gudangId) params.append('gudangId', gudangId)

        const response = await fetch(`/api/inventory/masuk?${params}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Gagal memuat data')
        }

        const responseData = data.data || data
        setMasukList(responseData.masukList || [])
        setPagination(responseData.pagination || pagination)
      } catch (error) {
        console.error('Failed to fetch barang masuk:', error)
        setError(error instanceof Error ? error.message : 'Gagal memuat data')
      } finally {
        setLoading(false)
      }
    }

    fetchMasukList()
  }, [page, refreshTrigger, search, startDate, endDate, siteId, gudangId])

  const handleDelete = async (id: string, kode: string, jumlah: number) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus record barang masuk ${kode} (${jumlah} pcs)?\n\nPeringatan: Ini akan mengurangi stok barang!`)) {
      return
    }

    try {
      const response = await fetch(`/api/inventory/masuk/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menghapus record barang masuk')
      }

      // Refresh data
      window.location.reload()
    } catch (error) {
      console.error('Failed to delete barang masuk:', error)
      alert(error instanceof Error ? error.message : 'Gagal menghapus record barang masuk')
    }
  }

  // Define columns for ResponsiveTable
  const columns: Column<BarangMasuk>[] = [
    {
      key: 'tanggal',
      header: 'Tanggal',
      priority: 'primary',
      render: (item) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {new Date(item.tanggal).toLocaleDateString('id-ID')}
        </span>
      )
    },
    {
      key: 'barang',
      header: 'Barang',
      priority: 'primary',
      render: (item) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {item.barang.kode}
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            {item.barang.nama}
          </div>
        </div>
      )
    },
    {
      key: 'gudang',
      header: 'Gudang',
      priority: 'secondary',
      render: (item) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {item.gudang.kode}
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            {item.gudang.nama}
          </div>
        </div>
      )
    },
    {
      key: 'jumlah',
      header: 'Jumlah',
      priority: 'primary',
      render: (item) => (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
          +{item.jumlah} {item.barang.satuan}
        </span>
      )
    },
    {
      key: 'kondisi',
      header: 'Kondisi',
      priority: 'secondary',
      render: (item) => (
        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${item.kondisi === 'BARU'
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
          : item.kondisi === 'BEKAS'
            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
          }`}>
          {item.kondisi === 'BARU' && <><FiCheckCircle className="mr-1" /> Baru</>}
          {item.kondisi === 'BEKAS' && <><FiAlertTriangle className="mr-1" /> Bekas</>}
          {item.kondisi === 'RUSAK' && <><FiXCircle className="mr-1" /> Rusak</>}
        </span>
      )
    },
    {
      key: 'keterangan',
      header: 'Keterangan',
      priority: 'tertiary',
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">
          {item.keterangan || '-'}
        </div>
      )
    },
    {
      key: 'user',
      header: 'Diproses Oleh',
      priority: 'tertiary',
      render: (item) => (
        item.user ? (
          <div className="text-sm">
            <div className="font-medium text-green-600 dark:text-green-400 flex items-center">
              <FiUser className="mr-1" /> {item.user.name || 'Unknown'}
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">
              {item.user.email}
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-500 dark:text-gray-400">System</span>
        )
      )
    },
    {
      key: 'fotoBukti',
      header: 'Foto',
      priority: 'tertiary',
      align: 'center',
      render: (item) => (
        item.fotoBukti && item.fotoBukti.length > 0 ? (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            <FiPaperclip className="h-3 w-3 mr-1" />
            {item.fotoBukti.length}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">
            <FiCamera className="h-4 w-4" />
          </span>
        )
      )
    }
  ]

  // Render actions for each row
  const renderActions = (item: BarangMasuk) => (
    <>
      <button
        onClick={() => onView?.(item)}
        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1"
        title="Lihat Detail"
      >
        <FiEye className="h-4 w-4" />
      </button>
      <button
        onClick={() => onEdit?.(item)}
        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
        title="Edit"
      >
        <FiEdit className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleDelete(item.id, item.barang.kode, item.jumlah)}
        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1"
        title="Hapus"
      >
        <FiTrash2 className="h-4 w-4" />
      </button>
    </>
  )

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {/* Responsive Table */}
      <ResponsiveTable
        data={masukList}
        columns={columns}
        keyField="id"
        loading={loading}
        emptyMessage="Tidak ada data barang masuk"
        loadingMessage="Memuat data..."
        renderActions={renderActions}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 gap-3">
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