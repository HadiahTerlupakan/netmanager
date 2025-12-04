"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiArrowPath,
  HiBars3,
  HiOutlineBanknotes,
  HiOutlineArrowDownCircle,
  HiOutlineArrowUpCircle,
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineDocumentArrowDown,
  HiOutlineDocumentArrowUp,
  HiOutlineTrendingUp,
  HiOutlineTrendingDown,
} from 'react-icons/hi2'
import { useFinance } from '@/hooks/useFinance'
import TransaksiModal from '@/components/finance/TransaksiModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, PieChart } from 'recharts'
import PageLoader from '@/components/ui/PageLoader'

const formatRupiah = (amount: number | string) => {
  const numAmount = typeof amount === 'string' ? Number(amount) : amount
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(numAmount)
}

const formatDate = (dateString: string | Date) => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const getNamaBulan = (bulan: number) => {
  const bulanNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  return bulanNames[bulan - 1]
}

export default function FinanceCashflowPage() {
  const router = useRouter()
  const { data: financeUser, loading, refreshing, refresh } = useFinance()
  const [cashflowData, setCashflowData] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  })
  const [loadingData, setLoadingData] = useState(true)
  const [transaksiModalOpen, setTransaksiModalOpen] = useState(false)
  const [transaksiEditId, setTransaksiEditId] = useState<string | null>(null)
  const [transaksiEditType, setTransaksiEditType] = useState<'pemasukan' | 'pengeluaran' | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteType, setDeleteType] = useState<'pengeluaran' | 'pemasukan' | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter states
  const [filterPeriod, setFilterPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('')
  const [searchDescription, setSearchDescription] = useState<string>('')

  // Import states
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])

  const fetchData = async (page = 1) => {
    try {
      const token = localStorage.getItem('finance_token')
      if (!token) return

      setLoadingData(true)

      // Build query parameters for filters
      const queryParams = new URLSearchParams()
      queryParams.append('page', page.toString())
      queryParams.append('limit', pagination.limit.toString())

      if (filterPeriod) queryParams.append('period', filterPeriod)
      if (filterStartDate) queryParams.append('startDate', filterStartDate)
      if (filterEndDate) queryParams.append('endDate', filterEndDate)
      if (filterCategory) queryParams.append('category', filterCategory)
      if (filterPaymentMethod) queryParams.append('paymentMethod', filterPaymentMethod)
      if (searchDescription) queryParams.append('search', searchDescription)

      // Fetch cashflow summary (Optimized)
      const cashflowRes = await fetch('/api/finance/cashflow', {
        headers: { 'x-finance-token': token },
      })
      if (cashflowRes.ok) {
        const data = await cashflowRes.json()
        setCashflowData(data)
      }

      // Fetch paginated transactions with filters
      const transactionsRes = await fetch(`/api/finance/transactions?${queryParams.toString()}`, {
        headers: { 'x-finance-token': token },
      })
      if (transactionsRes.ok) {
        const data = await transactionsRes.json()
        setTransactions(data.data)
        setPagination(prev => ({
          ...prev,
          page: data.pagination.page,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (financeUser) {
      fetchData(pagination.page)
    }
  }, [financeUser, pagination.page])

  const handleRefresh = () => {
    refresh()
    fetchData(1)
  }

  const handleDelete = async () => {
    if (!deleteId || !deleteType) return
    setIsDeleting(true)
    const idToDelete = deleteId
    const typeToDelete = deleteType
    setDeleteId(null)
    setDeleteType(null)
    try {
      const token = localStorage.getItem('finance_token')
      const endpoint = typeToDelete === 'pengeluaran'
        ? `/api/finance/pengeluaran/${idToDelete}`
        : `/api/finance/pemasukan/${idToDelete}`
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'x-finance-token': token || '',
        },
      })

      if (response.ok) {
        // Refresh data to update cashflow and list
        fetchData(pagination.page)
      } else {
        const data = await response.json()
        alert(data.error || `Gagal menghapus ${typeToDelete}`)
      }
    } catch (error) {
      console.error(`Error deleting ${typeToDelete}:`, error)
      alert(`Terjadi kesalahan saat menghapus ${typeToDelete}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const token = localStorage.getItem('finance_token')
      if (!token) return

      // Build query parameters for filters
      const queryParams = new URLSearchParams()

      if (filterPeriod) queryParams.append('period', filterPeriod)
      if (filterStartDate) queryParams.append('startDate', filterStartDate)
      if (filterEndDate) queryParams.append('endDate', filterEndDate)
      if (filterCategory) queryParams.append('category', filterCategory)
      if (filterPaymentMethod) queryParams.append('paymentMethod', filterPaymentMethod)
      if (searchDescription) queryParams.append('search', searchDescription)
      queryParams.append('format', format)

      const response = await fetch(`/api/finance/transactions/export?${queryParams.toString()}`, {
        headers: { 'x-finance-token': token },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `cashflow-transactions.${format === 'excel' ? 'xlsx' : 'csv'}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const data = await response.json()
        alert(data.error || `Gagal mengekspor data ke format ${format}`)
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      alert(`Terjadi kesalahan saat mengekspor data ke format ${format}`)
    }
  }

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      setImportErrors([])

      // Read and preview the file
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string
          const lines = text.split('\n')
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

          // Validate required headers
          const requiredHeaders = ['Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Jumlah']
          const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

          if (missingHeaders.length > 0) {
            setImportErrors([`Header yang diperlukan tidak ada: ${missingHeaders.join(', ')}`])
            setImportPreview([])
            return
          }

          // Parse data
          const data = lines.slice(1).filter(line => line.trim()).map((line, index) => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
            const row: any = {}

            headers.forEach((header, i) => {
              row[header] = values[i] || ''
            })

            return {
              index: index + 2, // +2 because of header and 0-based index
              ...row
            }
          })

          setImportPreview(data.slice(0, 5)) // Show only first 5 rows for preview

          // Validate data
          const errors: string[] = []
          data.forEach((row, index) => {
            const rowNum = index + 2

            if (!row.Tanggal) {
              errors.push(`Baris ${rowNum}: Tanggal tidak boleh kosong`)
            } else if (isNaN(Date.parse(row.Tanggal))) {
              errors.push(`Baris ${rowNum}: Format tanggal tidak valid`)
            }

            if (!row.Jenis || !['Pemasukan', 'Pengeluaran'].includes(row.Jenis)) {
              errors.push(`Baris ${rowNum}: Jenis harus "Pemasukan" atau "Pengeluaran"`)
            }

            if (!row.Kategori) {
              errors.push(`Baris ${rowNum}: Kategori tidak boleh kosong`)
            }

            if (!row.Deskripsi) {
              errors.push(`Baris ${rowNum}: Deskripsi tidak boleh kosong`)
            }

            if (!row.Jumlah || isNaN(Number(row.Jumlah))) {
              errors.push(`Baris ${rowNum}: Jumlah harus berupa angka`)
            }
          })

          setImportErrors(errors)
        } catch (error) {
          console.error('Error parsing file:', error)
          setImportErrors(['File tidak dapat dibaca. Pastikan format file CSV benar.'])
          setImportPreview([])
        }
      }

      reader.readAsText(file)
    }
  }

  const handleImport = async () => {
    if (!importFile || importErrors.length > 0) return

    setImportLoading(true)
    try {
      const token = localStorage.getItem('finance_token')
      if (!token) return

      const formData = new FormData()
      formData.append('file', importFile)

      const response = await fetch('/api/finance/transactions/import', {
        method: 'POST',
        headers: { 'x-finance-token': token },
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Berhasil mengimport ${data.imported} transaksi. ${data.errors.length} transaksi gagal diimport.`)
        setImportModalOpen(false)
        setImportFile(null)
        setImportPreview([])
        setImportErrors([])
        fetchData(1)
      } else {
        setImportErrors([data.error || 'Gagal mengimport data'])
      }
    } catch (error) {
      console.error('Error importing data:', error)
      setImportErrors(['Terjadi kesalahan saat mengimport data'])
    } finally {
      setImportLoading(false)
    }
  }

  const handleDownloadTemplate = () => {
    // Create CSV template
    const headers = ['Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Jumlah', 'Metode Pembayaran', 'Catatan']
    const sampleData = [
      ['2023-12-01', 'Pemasukan', 'PENJUALAN', 'Pembayaran langganan bulanan', '500000', 'TRANSFER', 'Langganan ISP'],
      ['2023-12-02', 'Pengeluaran', 'OPERASIONAL', 'Pembayaran listrik kantor', '1500000', 'TRANSFER', 'Listrik PLN'],
      ['2023-12-03', 'Pengeluaran', 'GAJI', 'Gaji karyawan', '5000000', 'TRANSFER', 'Gaji bulanan Desember']
    ]

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row =>
        row.map(cell => {
          // Handle values that contain commas or quotes
          if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
            return `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        }).join(',')
      )
    ].join('\n')

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-import-transaksi.csv'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  if (loading || loadingData) {
    return <PageLoader />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg md:ml-0 safe-area-inset-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <button
                onClick={() => {
                  if ((window as any).toggleFinanceSidebar) {
                    ; (window as any).toggleFinanceSidebar()
                  }
                }}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors md:hidden flex-shrink-0"
                aria-label="Open menu"
              >
                <HiBars3 className="w-6 h-6" />
              </button>
              <div className="w-9 h-9 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <HiOutlineBanknotes className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h1 className="text-lg md:text-xl font-bold truncate">Cashflow</h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  setTransaksiEditId(null)
                  setTransaksiEditType(null)
                  setTransaksiModalOpen(true)
                }}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors"
                title="Tambah Transaksi"
              >
                <HiOutlinePlus className="w-6 h-6" />
              </button>
              <div className="relative">
                <button
                  onClick={() => {
                    const dropdown = document.getElementById('export-dropdown')
                    if (dropdown) {
                      dropdown.classList.toggle('hidden')
                    }
                  }}
                  className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors"
                  title="Export Data"
                >
                  <HiOutlineDocumentArrowDown className="w-6 h-6" />
                </button>
                <div id="export-dropdown" className="hidden absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleExport('csv')
                        document.getElementById('export-dropdown')?.classList.add('hidden')
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Export ke CSV
                    </button>
                    <button
                      onClick={() => {
                        handleExport('excel')
                        document.getElementById('export-dropdown')?.classList.add('hidden')
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Export ke Excel
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setImportModalOpen(true)}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors"
                title="Import Data"
              >
                <HiOutlineDocumentArrowUp className="w-6 h-6" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing || loadingData}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <HiArrowPath className={`w-6 h-6 ${loading || refreshing || loadingData ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        {/* Add Button - Desktop */}
        <div className="mb-4 hidden md:block">
          <button
            onClick={() => {
              setTransaksiEditId(null)
              setTransaksiEditType(null)
              setTransaksiModalOpen(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Tambah Transaksi
          </button>
        </div>

        {/* Filters Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filter Transaksi</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Period Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Periode
              </label>
              <select
                value={filterPeriod}
                onChange={(e) => {
                  setFilterPeriod(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')
                  // Set default date range based on period
                  const today = new Date()
                  let startDate = new Date()

                  if (e.target.value === 'daily') {
                    startDate = today
                  } else if (e.target.value === 'weekly') {
                    startDate.setDate(today.getDate() - 7)
                  } else if (e.target.value === 'monthly') {
                    startDate.setMonth(today.getMonth() - 1)
                  } else if (e.target.value === 'yearly') {
                    startDate.setFullYear(today.getFullYear() - 1)
                  }

                  setFilterStartDate(startDate.toISOString().split('T')[0])
                  setFilterEndDate(today.toISOString().split('T')[0])
                }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="daily">Harian</option>
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tanggal Selesai
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Search Description */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Pencarian Deskripsi
              </label>
              <input
                type="text"
                value={searchDescription}
                onChange={(e) => setSearchDescription(e.target.value)}
                placeholder="Cari deskripsi transaksi..."
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {/* Category Filter */}
            <div className="flex-1 space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Kategori
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Semua Kategori</option>
                <optgroup label="Pemasukan">
                  <option value="PENJUALAN">Penjualan</option>
                  <option value="INVESTASI">Investasi</option>
                  <option value="BONUS">Bonus</option>
                  <option value="HADIAH">Hadiah</option>
                  <option value="SEWA">Sewa</option>
                  <option value="LAINNYA">Lainnya</option>
                </optgroup>
                <optgroup label="Pengeluaran">
                  <option value="OPERASIONAL">Operasional</option>
                  <option value="PEMELIHARAAN">Pemeliharaan</option>
                  <option value="GAJI">Gaji</option>
                  <option value="BONUS">Bonus</option>
                  <option value="SEWA">Sewa</option>
                  <option value="LISTRIK">Listrik</option>
                  <option value="INTERNET">Internet</option>
                  <option value="TELEPON">Telepon</option>
                  <option value="BENSIN">Bensin</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="LAINNYA">Lainnya</option>
                </optgroup>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex-1 space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Metode Pembayaran
              </label>
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Semua Metode</option>
                <option value="TRANSFER">Transfer</option>
                <option value="CASH">Cash</option>
                <option value="DEBIT">Debit</option>
                <option value="KREDIT">Kredit</option>
                <option value="E-WALLET">E-Wallet</option>
              </select>
            </div>

            {/* Apply and Reset Buttons */}
            <div className="flex items-end gap-2">
              <button
                onClick={() => fetchData(1)}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Terapkan Filter
              </button>
              <button
                onClick={() => {
                  setFilterPeriod('monthly')
                  setFilterStartDate('')
                  setFilterEndDate('')
                  setFilterCategory('')
                  setFilterPaymentMethod('')
                  setSearchDescription('')
                  fetchData(1)
                }}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {/* Pemasukan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Total Pemasukan
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {cashflowData ? formatRupiah(cashflowData.summary.totalPemasukan) : formatRupiah(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {cashflowData ? `Tagihan: ${formatRupiah(cashflowData.summary.totalPemasukanTagihan || 0)} + Manual: ${formatRupiah(cashflowData.summary.totalPemasukanManual || 0)}` : 'Memuat...'}
                </p>
              </div>
              <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <HiOutlineArrowDownCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          {/* Pengeluaran */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Total Pengeluaran
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {cashflowData ? formatRupiah(cashflowData.summary.totalPengeluaran) : formatRupiah(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {cashflowData ? `${pagination.total} transaksi` : '...'}
                </p>
              </div>
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <HiOutlineArrowUpCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Saldo */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Saldo
                </p>
                <p className={`text-2xl font-bold ${cashflowData && cashflowData.summary.saldo >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                  {cashflowData ? formatRupiah(cashflowData.summary.saldo) : formatRupiah(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Pemasukan - Pengeluaran
                </p>
              </div>
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <HiOutlineBanknotes className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* CAPEX */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Total CAPEX
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {cashflowData ? formatRupiah(cashflowData.summary.totalCapex) : formatRupiah(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Capital Expenditure
                </p>
              </div>
              <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <HiOutlineBanknotes className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          {/* OPEX */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Total OPEX
                </p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {cashflowData ? formatRupiah(cashflowData.summary.totalOpex) : formatRupiah(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Operational Expenditure
                </p>
              </div>
              <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <HiOutlineBanknotes className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Cash Flow Statement */}
        {cashflowData && cashflowData.cashFlowStatement && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cash Flow Statement</h3>

            <div className="space-y-4">
              {/* Operating Activities */}
              <div>
                <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Operating Activities</h4>
                <div className="pl-4 space-y-1">
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Cash from Customers</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {formatRupiah(cashflowData.cashFlowStatement.operatingActivities.cashFromCustomers)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Cash to Suppliers</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      ({formatRupiah(cashflowData.cashFlowStatement.operatingActivities.cashToSuppliers)})
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Net Operating Cash Flow</span>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                      {formatRupiah(cashflowData.cashFlowStatement.operatingActivities.netOperating)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Investing Activities */}
              <div>
                <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Investing Activities</h4>
                <div className="pl-4 space-y-1">
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Equipment Purchases (CAPEX)</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      ({formatRupiah(cashflowData.cashFlowStatement.investingActivities.equipmentPurchases)})
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-orange-700 dark:text-orange-400">Net Investing Cash Flow</span>
                    <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                      {formatRupiah(cashflowData.cashFlowStatement.investingActivities.netInvesting)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financing Activities */}
              <div>
                <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Financing Activities</h4>
                <div className="pl-4 space-y-1">
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Loans Received</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {formatRupiah(cashflowData.cashFlowStatement.financingActivities.loansReceived)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-400">Net Financing Cash Flow</span>
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                      {formatRupiah(cashflowData.cashFlowStatement.financingActivities.netFinancing)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Opening Cash</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatRupiah(cashflowData.cashFlowStatement.openingCash)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Net Cash Flow</span>
                    <span className={`text-sm font-medium ${Number(cashflowData.cashFlowStatement.netCashFlow) >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                      }`}>
                      {formatRupiah(cashflowData.cashFlowStatement.netCashFlow)}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 px-4 rounded-lg">
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Closing Cash</span>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                      {formatRupiah(cashflowData.cashFlowStatement.closingCash)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cash Flow Trend Chart */}
        {cashflowData && cashflowData.perBulan && cashflowData.perBulan.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trend Cash Flow (6 Bulan Terakhir)</h3>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={cashflowData.perBulan.map((item: any) => ({
                    month: `${item.bulan} ${item.tahun}`,
                    pemasukan: Number(item.pemasukan),
                    pengeluaran: Number(item.pengeluaran),
                    saldo: Number(item.saldo)
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  xDataKey="month"
                  yDataKey="saldo"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    labelFormatter={(value) => formatRupiah(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', color: '#fff', borderRadius: '4px' }}
                    formatter={(value, name) => {
                      if (name === 'saldo') {
                        return (
                          <div>
                            <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>{`${item.bulan} ${item.tahun}`}</p>
                            <p style={{ margin: '0 0 8px 0' }}>Saldo: {formatRupiah(Number(value))}</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pemasukan"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: "#22c55e", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pengeluaran"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: "#ef4444", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Cash Flow Composition Chart */}
        {cashflowData && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Komposisi Cash Flow</h3>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart
                  data={[
                    { name: 'Pemasukan', value: cashflowData.summary.totalPemasukan, fill: '#22c55e' },
                    { name: 'Pengeluaran', value: cashflowData.summary.totalPengeluaran, fill: '#ef4444' },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  labelKey="name"
                  label={({ name, percent }) => `${name}: ${formatRupiah(Number(value))} (${percent.toFixed(1)}%)`}
                  labelStyle={{ fontSize: 14, fill: '#fff' }}
                />
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Comparison with Previous Period */}
        {cashflowData && cashflowData.comparison && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Perbandingan dengan Periode Sebelumnya</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Perubahan Pemasukan</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${cashflowData.comparison.changes.pemasukan.percentage >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
                  }`}>
                  {cashflowData.comparison.changes.pemasukan.percentage >= 0 ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0l-4-4m4 4l4 4m-4-4v6" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0l-4 4m4-4l4-4m-4 4v-6" />
                    </svg>
                  )}
                  {cashflowData.comparison.changes.pemasukan.percentage.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formatRupiah(cashflowData.comparison.changes.pemasukan.amount)}
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Perubahan Pengeluaran</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${cashflowData.comparison.changes.pengeluaran.percentage >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
                  }`}>
                  {cashflowData.comparison.changes.pengeluaran.percentage >= 0 ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0l-4-4m4 4l4 4m-4-4v6" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0l-4 4m4-4l4-4m-4 4v-6" />
                    </svg>
                  )}
                  {cashflowData.comparison.changes.pengeluaran.percentage.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formatRupiah(cashflowData.comparison.changes.pengeluaran.amount)}
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Perubahan Saldo</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${cashflowData.comparison.changes.saldo.percentage >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
                  }`}>
                  {cashflowData.comparison.changes.saldo.percentage >= 0 ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0l-4-4m4 4l4 4m-4-4v6" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0l-4 4m4-4l4-4m-4 4v-6" />
                    </svg>
                  )}
                  {cashflowData.comparison.changes.saldo.percentage.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formatRupiah(cashflowData.comparison.changes.saldo.amount)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* List Transaksi (Pemasukan & Pengeluaran) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daftar Transaksi</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Kelola data pemasukan dan pengeluaran
              </p>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total: {pagination.total} data
            </div>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 p-4">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                Belum ada data transaksi
              </div>
            ) : (
              transactions.map((transaksi: any) => (
                <div key={`${transaksi.type}-${transaksi.id}`} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${transaksi.type === 'pemasukan'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                          {transaksi.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                        {transaksi.type === 'pengeluaran' && transaksi.tipePengeluaran && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${transaksi.tipePengeluaran === 'CAPEX'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                            }`}>
                            {transaksi.tipePengeluaran}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{transaksi.deskripsi}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(transaksi.tanggal)}</p>
                    </div>
                    <div className={`text-right ${transaksi.type === 'pemasukan'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                      }`}>
                      <p className="text-sm font-semibold">{transaksi.type === 'pemasukan' ? '+' : '-'} {formatRupiah(transaksi.jumlah)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        {transaksi.kategori}
                      </span>
                      {transaksi.metodeBayar && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {transaksi.metodeBayar}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setTransaksiEditId(transaksi.id)
                          setTransaksiEditType(transaksi.type)
                          setTransaksiModalOpen(true)
                        }}
                        className="touch-target p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <HiOutlinePencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteId(transaksi.id)
                          setDeleteType(transaksi.type)
                        }}
                        className="touch-target p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nomor Bukti
                  </th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Jenis
                  </th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tipe (CAPEX/OPEX)
                  </th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deskripsi
                  </th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Jumlah
                  </th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Metode
                  </th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      Belum ada data transaksi
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaksi: any) => (
                    <tr key={`${transaksi.type}-${transaksi.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {transaksi.nomorBukti || '-'}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(transaksi.tanggal)}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${transaksi.type === 'pemasukan'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                          {transaksi.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        {transaksi.type === 'pengeluaran' && transaksi.tipePengeluaran ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${transaksi.tipePengeluaran === 'CAPEX'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                            }`}>
                            {transaksi.tipePengeluaran}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          {transaksi.kategori}
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-2 md:py-4">
                        <div className="text-sm text-gray-900 dark:text-white max-w-md truncate">
                          {transaksi.deskripsi}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${transaksi.type === 'pemasukan'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                          }`}>
                          {transaksi.type === 'pemasukan' ? '+' : '-'} {formatRupiah(transaksi.jumlah)}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {transaksi.metodeBayar || '-'}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {transaksi.createdByUser?.name || transaksi.createdByUser?.email || '-'}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setTransaksiEditId(transaksi.id)
                              setTransaksiEditType(transaksi.type)
                              setTransaksiModalOpen(true)
                            }}
                            className="touch-target p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <HiOutlinePencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteId(transaksi.id)
                              setDeleteType(transaksi.type)
                            }}
                            className="touch-target p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <HiOutlineTrash className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Halaman {pagination.page} dari {pagination.totalPages}
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => fetchData(pagination.page - 1)}
                disabled={pagination.page <= 1 || loadingData}
                className="touch-target flex-1 md:flex-none px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => fetchData(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loadingData}
                className="touch-target flex-1 md:flex-none px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal untuk Create/Edit Transaksi */}
      <TransaksiModal
        isOpen={transaksiModalOpen}
        onClose={() => {
          setTransaksiModalOpen(false)
          setTransaksiEditId(null)
          setTransaksiEditType(null)
        }}
        onSuccess={() => {
          handleRefresh()
        }}
        transaksiId={transaksiEditId}
        transaksiType={transaksiEditType}
        apiEndpoint="/api/finance"
        token={localStorage.getItem('finance_token')}
      />

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <ConfirmDialog
          open={!!deleteId}
          onCancel={() => {
            setDeleteId(null)
            setDeleteType(null)
          }}
          onConfirm={handleDelete}
          title={`Hapus ${deleteType === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}`}
          description={`Apakah Anda yakin ingin menghapus ${deleteType === 'pemasukan' ? 'pemasukan' : 'pengeluaran'} ini? Tindakan ini tidak dapat dibatalkan.`}
          confirmText="Hapus"
          cancelText="Batal"
        />
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Import Transaksi</h2>
                <button
                  onClick={() => {
                    setImportModalOpen(false)
                    setImportFile(null)
                    setImportPreview([])
                    setImportErrors([])
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pilih File CSV
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportFileChange}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Format file harus CSV dengan header: Tanggal, Jenis, Kategori, Deskripsi, Jumlah, Metode Pembayaran, Catatan
                  </p>
                  <button
                    onClick={handleDownloadTemplate}
                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                  >
                    Download Template
                  </button>
                </div>
              </div>

              {importErrors.length > 0 && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">Error:</h3>
                  <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                    {importErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview (5 baris pertama):</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Baris</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jenis</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deskripsi</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {importPreview.map((row, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{row.index}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{row.Tanggal}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{row.Jenis}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{row.Kategori}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.Deskripsi}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{row.Jumlah}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setImportModalOpen(false)
                    setImportFile(null)
                    setImportPreview([])
                    setImportErrors([])
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile || importErrors.length > 0 || importLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {importLoading ? 'Mengimport...' : 'Import'}
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Download Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
