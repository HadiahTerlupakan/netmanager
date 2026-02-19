'use client'

import { useState, useEffect, useCallback } from 'react'
import { FiEdit2, FiTrash2, FiEye, FiFilter, FiDownload, FiMinusCircle } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import type { StockOpnameRecord } from '@/lib/types/inventory'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'

interface OpnameReportTableProps {
  onEdit?: ((opname: StockOpnameRecord) => void) | undefined
  onView?: ((opname: StockOpnameRecord) => void) | undefined
  refreshTrigger?: number
}

export function OpnameReportTable({ onEdit, onView, refreshTrigger = 0 }: OpnameReportTableProps) {
  const [opnameList, setOpnameList] = useState<StockOpnameRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [_filters, _setFilters] = useState({
    tanggalMulai: '',
    tanggalSelesai: '',
    kondisi: 'semua',
    barangId: '',
    gudangId: ''
  })

  // Calculate statistics
  const totalItems = opnameList.length
  const akurasiStok = totalItems > 0
    ? Math.round((opnameList.filter(item => item.selisih === 0).length / totalItems) * 100)
    : 100
  const totalBaik = opnameList.reduce((sum, item) => sum + item.kondisiBaik, 0)
  const totalRusak = opnameList.reduce((sum, item) => sum + item.kondisiRusak, 0)
  // Only count as "hilang" if alasanSelisih is explicitly 'hilang'
  const totalHilang = opnameList
    .filter(item => item.alasanSelisih === 'hilang')
    .reduce((sum, item) => sum + Math.abs(item.selisih), 0)
  const totalPerluPerhatian = totalRusak + totalHilang

  const limit = 20

  const fetchOpnameList = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(_filters.barangId && { barangId: _filters.barangId }),
        ...(_filters.gudangId && { gudangId: _filters.gudangId })
      })

      const response = await fetch(`/api/inventory/opname/list?${params}`)
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal memuat data stock opname')
      }

      const data = await response.json()
      // Handle both wrapped (apiSuccess) and unwrapped response formats
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
  }, [currentPage, _filters.barangId, _filters.gudangId, limit])

  useEffect(() => {
    fetchOpnameList()
  }, [fetchOpnameList, refreshTrigger])

  const handleDelete = async (id: string) => {
    // Check if ID is valid
    if (!id || id.trim() === '') {
      alert('ID tidak valid, tidak dapat menghapus record')
      return
    }

    if (!confirm('Apakah Anda yakin ingin menghapus record stock opname ini?')) {
      return
    }

    setDeletingId(id)
    try {
      const response = await fetch(`/api/inventory/opname/${id.trim()}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gagal menghapus stock opname (${response.status}): ${errorText}`)
      }

      // Refresh the list
      await fetchOpnameList()
    } catch (error) {
      console.error('Error deleting stock opname:', error)
      alert(error instanceof Error ? error.message : 'Gagal menghapus stock opname')
    } finally {
      setDeletingId(null)
    }
  }

  const handleExportCSV = () => {
    // Create CSV content
    const headers = ['Tanggal', 'Barang', 'Gudang', 'Stok Sistem', 'Stok Fisik', 'Selisih', 'Kondisi', 'Lokasi', 'PIC']
    const rows = opnameList.map(item => [
      new Date(item.createdAt).toLocaleDateString('id-ID'),
      `${item.barang.kode} - ${item.barang.nama}`,
      item.gudang.nama,
      item.stokSistem.toString(),
      item.stokFisik.toString(),
      item.selisih.toString(),
      `${item.kondisiBaik}/${item.kondisiRusak}/${item.kondisiExpire}`,
      item.lokasiPenyimpanan || '-',
      item.pic || '-'
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `stock_opname_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getSelisihBadge = (selisih: number) => {
    if (selisih === 0) {
      return { color: 'bg-green-100 text-green-800', text: 'Tidak ada selisih' }
    } else if (selisih > 0) {
      return { color: 'bg-blue-100 text-blue-800', text: `+${selisih}` }
    } else {
      return { color: 'bg-red-100 text-red-800', text: `${selisih}` }
    }
  }

  const getQualityBadge = (baik: number, rusak: number, bekas: number) => {
    const total = baik + rusak + bekas
    if (total === 0) return null
    const persentase = (baik / total) * 100

    if (persentase >= 95) {
      return { color: 'bg-green-100 text-green-800', text: `${Math.round(persentase)}% baik` }
    } else if (persentase >= 85) {
      return { color: 'bg-yellow-100 text-yellow-800', text: `${Math.round(persentase)}% baik` }
    } else {
      return { color: 'bg-red-100 text-red-800', text: `${Math.round(persentase)}% baik` }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
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
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {formatDate(item.createdAt)}
        </div>
      )
    },
    {
      key: 'barang',
      header: 'Barang',
      priority: 'primary',
      render: (item) => (
        <>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
                {item.barang.kode}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
                {item.barang.nama}
            </div>
        </>
      )
    },
    {
      key: 'gudang',
      header: 'Gudang',
      priority: 'secondary',
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {item.gudang.nama}
        </div>
      )
    },
    {
      key: 'stokSistem',
      header: 'Stok Sistem',
      priority: 'tertiary',
      render: (item) => (
        <div className="text-center">
            <span className="text-sm font-medium text-blue-600">
                {item.stokSistem}
            </span>
        </div>
      )
    },
    {
      key: 'stokFisik',
      header: 'Stok Fisik',
      priority: 'primary',
      render: (item) => (
        <div className="text-center">
            <span className="text-sm font-bold text-green-600">
                {item.stokFisik}
            </span>
        </div>
      )
    },
    {
      key: 'selisih',
      header: 'Selisih',
      priority: 'primary',
      render: (item) => {
        const selisihBadge = getSelisihBadge(item.selisih)
        const isHilang = item.alasanSelisih === 'hilang'
        return (
            <div className="flex flex-col items-center gap-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selisihBadge.color}`}>
                {selisihBadge.text}
                </span>
                {isHilang && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                    <FiMinusCircle className="w-3 h-3" /> HILANG
                </span>
                )}
            </div>
        )
      }
    },
    {
      key: 'alasanSelisih',
      header: 'Alasan',
      priority: 'secondary',
      render: (item) => {
        if (item.selisih === 0) return <span className="text-gray-400">-</span>
        const alasanLabels: Record<string, string> = {
          'hilang': 'Hilang',
          'rusak': 'Rusak',
          'revisi': 'Revisi',
          'salah_input': 'Salah Input',
          'terpakai': 'Terpakai',
          'expired': 'Expired',
          'lebih': 'Stok Lebih',
          'lainnya': 'Lainnya'
        }
        return (
          <span className="text-sm text-gray-900 dark:text-white">
            {item.alasanSelisih ? alasanLabels[item.alasanSelisih] || item.alasanSelisih : '-'}
          </span>
        )
      }
    },
    {
      key: 'kondisi',
      header: 'Kondisi',
      priority: 'secondary',
      render: (item) => {
        const qualityBadge = getQualityBadge(item.kondisiBaik, item.kondisiRusak, item.kondisiExpire)
        return (
            <div className="flex flex-col space-y-1">
                <div className="text-xs text-gray-600">
                {item.kondisiBaik}/{item.kondisiRusak}/{item.kondisiExpire}
                </div>
                {qualityBadge && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${qualityBadge.color}`}>
                    {qualityBadge.text}
                </span>
                )}
            </div>
        )
      }
    },
    {
      key: 'location',
      header: 'Lokasi',
      priority: 'tertiary',
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white">
            <div>{item.lokasiPenyimpanan || '-'}</div>
            {item.nomorRak && (
            <div className="text-xs text-gray-500">Rak {item.nomorRak}</div>
            )}
        </div>
      )
    },
    {
      key: 'pic',
      header: 'PIC',
      priority: 'tertiary',
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {item.pic || '-'}
        </div>
      )
    }
  ]

  const renderActions = (opname: StockOpnameRecord) => (
    <div className="flex justify-center space-x-2">
        {onView && (
        <Button
            onClick={() => onView(opname)}
            className="inline-flex items-center justify-center w-8 h-8 rounded text-blue-600 hover:bg-blue-50 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200"
            title="View Detail"
        >
            <FiEye className="h-4 w-4" />
        </Button>
        )}
        {onEdit && (
        <Button
            onClick={() => onEdit(opname)}
            className="inline-flex items-center justify-center w-8 h-8 rounded text-yellow-600 hover:bg-yellow-50 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 border border-yellow-200"
            title="Edit"
        >
            <FiEdit2 className="h-4 w-4" />
        </Button>
        )}
        <Button
        onClick={() => {
            console.log('Delete clicked for ID:', opname.id)
            handleDelete(opname.id)
        }}
        disabled={deletingId === opname.id}
        className="inline-flex items-center justify-center w-8 h-8 rounded text-red-600 hover:bg-red-50 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 border border-red-200"
        title="Delete"
        >
        <FiTrash2 className="h-4 w-4" />
        </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FiFilter className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Akurasi Stok</p>
              <p className="text-2xl font-bold text-green-600">{akurasiStok}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FiEye className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Kondisi Baik</p>
              <p className="text-2xl font-bold text-blue-600">{totalBaik}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FiEdit2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Barang Hilang</p>
              <p className="text-2xl font-bold text-purple-600">{totalHilang}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <FiMinusCircle className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Butuh Perhatian</p>
              <p className="text-2xl font-bold text-red-600">{totalPerluPerhatian}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FiTrash2 className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button variant="outline"
          onClick={handleExportCSV}
          
        >
          <FiDownload className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Detail Laporan Stock Opname
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {total} records found
          </span>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
            <Button
              onClick={fetchOpnameList}
               className="mt-2"
            >
              Retry
            </Button>
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
                <Button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                >
                  Next
                </Button>
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
                    <Button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    >
                      Previous
                    </Button>
                    {[...Array(totalPages)].map((_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/20'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                          }`}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    >
                      Next
                    </Button>
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