'use client'

import { useState, useEffect } from 'react'
import { FiEdit2, FiTrash2, FiEye, FiFilter, FiDownload } from 'react-icons/fi'

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

interface OpnameReportTableProps {
  onEdit?: (opname: StockOpnameRecord) => void
  onView?: (opname: StockOpnameRecord) => void
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
  const [filters, setFilters] = useState({
    tanggalMulai: '',
    tanggalSelesai: '',
    kondisi: 'semua',
    barangId: '',
    gudangId: ''
  })

  const limit = 20

  useEffect(() => {
    fetchOpnameList()
  }, [currentPage, filters, refreshTrigger])

  async function fetchOpnameList() {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(filters.barangId && { barangId: filters.barangId }),
        ...(filters.gudangId && { gudangId: filters.gudangId })
      })

      const response = await fetch(`/api/inventory/opname/list?${params}`)
      if (!response.ok) {
        throw new Error('Gagal memuat data stock opname')
      }

      const data = await response.json()
      setOpnameList(data.opnameList || [])
      setTotalPages(data.pagination?.totalPages || 0)
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error fetching opname list:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

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
      return { color: 'bg-green-100 text-green-800', text: 'Tidak ada selisih', isHilang: false }
    } else if (selisih > 0) {
      return { color: 'bg-blue-100 text-blue-800', text: `+${selisih}`, isHilang: false }
    } else {
      return { color: 'bg-red-100 text-red-800', text: `${selisih}`, isHilang: true } // Negative = missing/lost items
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

  // Calculate statistics
  const totalItems = opnameList.length
  const akurasiStok = totalItems > 0
    ? Math.round((opnameList.filter(item => item.selisih === 0).length / totalItems) * 100)
    : 100
  const totalBaik = opnameList.reduce((sum, item) => sum + item.kondisiBaik, 0)
  const totalRusak = opnameList.reduce((sum, item) => sum + item.kondisiRusak, 0)
  const totalHilang = opnameList
    .filter(item => item.selisih < 0)
    .reduce((sum, item) => sum + Math.abs(item.selisih), 0)
  const totalPerluPerhatian = totalRusak + totalHilang

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
              <span className="text-xl">🟣</span>
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
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <FiDownload className="mr-2 h-4 w-4" />
          Export CSV
        </button>
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

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchOpnameList}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : opnameList.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Belum ada data stock opname</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Barang
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Gudang
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stok Sistem
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stok Fisik
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Selisih
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Kondisi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Lokasi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    PIC
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {opnameList.map((opname) => {
                  const selisihBadge = getSelisihBadge(opname.selisih)
                  const qualityBadge = getQualityBadge(opname.kondisiBaik, opname.kondisiRusak, opname.kondisiExpire)

                  return (
                    <tr key={opname.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(opname.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {opname.barang.kode}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {opname.barang.nama}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {opname.gudang.nama}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-blue-600">
                          {opname.stokSistem}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-green-600">
                          {opname.stokFisik}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selisihBadge.color}`}>
                            {selisihBadge.text}
                          </span>
                          {selisihBadge.isHilang && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                              🟣 HILANG
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-1">
                          <div className="text-xs text-gray-600">
                            {opname.kondisiBaik}/{opname.kondisiRusak}/{opname.kondisiExpire}
                          </div>
                          {qualityBadge && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${qualityBadge.color}`}>
                              {qualityBadge.text}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-white">
                          <div>{opname.lokasiPenyimpanan || '-'}</div>
                          {opname.nomorRak && (
                            <div className="text-xs text-gray-500">Rak {opname.nomorRak}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {opname.pic || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center space-x-2">
                          {onView && (
                            <button
                              onClick={() => onView(opname)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded text-blue-600 hover:bg-blue-50 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200"
                              title="View Detail"
                            >
                              <FiEye className="h-4 w-4" />
                            </button>
                          )}
                          {onEdit && (
                            <button
                              onClick={() => onEdit(opname)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded text-yellow-600 hover:bg-yellow-50 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 border border-yellow-200"
                              title="Edit"
                            >
                              <FiEdit2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              console.log('Delete clicked for ID:', opname.id)
                              handleDelete(opname.id)
                            }}
                            disabled={deletingId === opname.id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded text-red-600 hover:bg-red-50 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 border border-red-200"
                            title="Delete"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
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