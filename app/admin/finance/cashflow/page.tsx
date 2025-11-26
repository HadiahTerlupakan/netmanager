"use client"

import { useEffect, useState } from 'react'
import {
  HiOutlineBanknotes,
  HiOutlineArrowDownCircle,
  HiOutlineArrowUpCircle,
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiArrowPath
} from 'react-icons/hi2'
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

export default function CashflowPage() {
  const [cashflowData, setCashflowData] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  })
  const [loading, setLoading] = useState(true)
  const [transaksiModalOpen, setTransaksiModalOpen] = useState(false)
  const [transaksiEditId, setTransaksiEditId] = useState<string | null>(null)
  const [transaksiEditType, setTransaksiEditType] = useState<'pemasukan' | 'pengeluaran' | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteType, setDeleteType] = useState<'pengeluaran' | 'pemasukan' | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadData(pagination.page)
  }, [pagination.page])

  const loadData = async (page = 1) => {
    setLoading(true)
    try {
      // Fetch cashflow summary (Optimized)
      const cashflowRes = await fetch('/api/finance/cashflow')
      if (cashflowRes.ok) {
        const data = await cashflowRes.json()
        setCashflowData(data)
      }

      // Fetch paginated transactions
      const transactionsRes = await fetch(`/api/finance/transactions?page=${page}&limit=${pagination.limit}`)
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
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId || !deleteType) return
    setIsDeleting(true)
    const idToDelete = deleteId
    const typeToDelete = deleteType
    setDeleteId(null)
    setDeleteType(null)
    try {
      const endpoint = typeToDelete === 'pengeluaran' ? `/api/pengeluaran/${idToDelete}` : `/api/pemasukan/${idToDelete}`
      const response = await fetch(endpoint, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadData(pagination.page) // Reload untuk update cashflow
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

  if (loading && !cashflowData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <HiOutlineBanknotes className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cashflow</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Laporan arus kas, kelola pemasukan dan pengeluaran</p>
        </div>
        <button
          onClick={() => {
            setTransaksiEditId(null)
            setTransaksiEditType(null)
            setTransaksiModalOpen(true)
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Tambah Transaksi
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {/* Pemasukan */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
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
                          className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
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
              onClick={() => loadData(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => loadData(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Modal untuk Create/Edit Transaksi */}
      <TransaksiModal
        isOpen={transaksiModalOpen}
        onClose={() => {
          setTransaksiModalOpen(false)
          setTransaksiEditId(null)
          setTransaksiEditType(null)
        }}
        onSuccess={() => {
          loadData(pagination.page)
        }}
        transaksiId={transaksiEditId}
        transaksiType={transaksiEditType}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => {
          setDeleteId(null)
          setDeleteType(null)
        }}
        onConfirm={() => {
          handleDelete()
        }}
        title={`Hapus ${deleteType === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}`}
        description={`Apakah Anda yakin ingin menghapus ${deleteType === 'pemasukan' ? 'pemasukan' : 'pengeluaran'} ini? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
      />
    </div>
  )
}
