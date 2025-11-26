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
} from 'react-icons/hi2'
import { useFinance } from '@/hooks/useFinance'
import TransaksiModal from '@/components/finance/TransaksiModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const formatRupiah = (amount: number | string | bigint) => {
  const numAmount = typeof amount === 'string' ? Number(amount) : typeof amount === 'bigint' ? Number(amount) : amount
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

  const fetchData = async (page = 1) => {
    try {
      const token = localStorage.getItem('finance_token')
      if (!token) return

      setLoadingData(true)

      // Fetch cashflow summary (Optimized)
      const cashflowRes = await fetch('/api/finance/cashflow', {
        headers: { 'x-finance-token': token },
      })
      if (cashflowRes.ok) {
        const data = await cashflowRes.json()
        setCashflowData(data)
      }

      // Fetch paginated transactions
      const transactionsRes = await fetch(`/api/finance/transactions?page=${page}&limit=${pagination.limit}`, {
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

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <HiArrowPath className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-4" />
          <div className="text-gray-500 dark:text-gray-400">Memuat data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg md:ml-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if ((window as any).toggleFinanceSidebar) {
                    ; (window as any).toggleFinanceSidebar()
                  }
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation md:hidden"
                aria-label="Open menu"
              >
                <HiBars3 className="w-6 h-6" />
              </button>
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <HiOutlineBanknotes className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold">Cashflow</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTransaksiEditId(null)
                  setTransaksiEditType(null)
                  setTransaksiModalOpen(true)
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                title="Tambah Transaksi"
              >
                <HiOutlinePlus className="w-6 h-6" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing || loadingData}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation disabled:opacity-50"
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Jenis
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tipe (CAPEX/OPEX)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deskripsi
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Jumlah
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Metode Bayar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Dibuat Oleh
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(transaksi.tanggal)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${transaksi.type === 'pemasukan'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                          {transaksi.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          {transaksi.kategori}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white max-w-md truncate">
                          {transaksi.deskripsi}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${transaksi.type === 'pemasukan'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                          }`}>
                          {transaksi.type === 'pemasukan' ? '+' : '-'} {formatRupiah(transaksi.jumlah)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {transaksi.metodeBayar || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {transaksi.createdByUser?.name || transaksi.createdByUser?.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setTransaksiEditId(transaksi.id)
                              setTransaksiEditType(transaksi.type)
                              setTransaksiModalOpen(true)
                            }}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <HiOutlinePencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteId(transaksi.id)
                              setDeleteType(transaksi.type)
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Halaman {pagination.page} dari {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchData(pagination.page - 1)}
                disabled={pagination.page <= 1 || loadingData}
                className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => fetchData(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loadingData}
                className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </div>
  )
}
