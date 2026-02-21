'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HiPlus, HiTrash, HiXCircle, HiPaperClip } from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PhotoUpload, type PhotoUploadRef } from '@/components/inventory/PhotoUpload'
import { MarketPriceCheck } from '@/components/procurement/MarketPriceCheck'
import { SiteFilter } from '@/components/common/SiteFilter'
import { usePermission } from '@/hooks/use-permission'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import type { Category, Account, Transaction } from '@/types'

interface TransactionsClientProps {
  categories: Category[]
  accounts: Account[]
}

export default function TransactionsClient({ categories, accounts }: TransactionsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountIdParam = searchParams.get('accountId')

  const { hasPermission } = usePermission()
  // Use generic expense permissions as proxy for finance transactions for now
  const canCreate = hasPermission('expense:create')
  const canDelete = hasPermission('expense:delete')

  const photoUploadRef = useRef<PhotoUploadRef>(null)
  
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSiteId, setFilterSiteId] = useState<string | undefined>(undefined)
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]) // Default start of month
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]) // Default today

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Transaction | null>(null)

  const [form, setForm] = useState({
    type: 'EXPENSE',
    categoryId: '',
    accountId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    attachments: [] as string[]
  })

  // Summary State
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.append('categoryId', filterCategory)
      if (filterSiteId) params.append('siteId', filterSiteId)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (accountIdParam) params.append('accountId', accountIdParam)

      const res = await fetch(`/api/finance/transactions?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json().catch((): null => null)
        throw new Error(errData?.error || 'Gagal mengambil data transaksi')
      }
      const json = await res.json()
      // API returns { success: true, data: [...] }
      const transactions = json.data || []
      setData(transactions)

      // Calculate Summary on Client for current filtered view
      const income = transactions.filter((t: Transaction) => t.type === 'INCOME').reduce((acc: number, t: Transaction) => acc + t.amount, 0)
      const expense = transactions.filter((t: Transaction) => t.type === 'EXPENSE').reduce((acc: number, t: Transaction) => acc + t.amount, 0)
      setSummary({
          income,
          expense,
          balance: income - expense
      })

    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Gagal mengambil data transaksi')
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterSiteId, startDate, endDate, accountIdParam])

  const handleDelete = async () => {
      if (!selectedItem) return
      setLoading(true)
      try {
      const res = await fetch(`/api/finance/transactions/${selectedItem.id}`, {
          method: 'DELETE'
      })
          if (!res.ok) {
            const errData = await res.json().catch((): null => null)
            throw new Error(errData?.error || 'Gagal menghapus transaksi')
          }

          toast.success('Transaksi berhasil dihapus')
          setDeleteModalOpen(false)
          setSelectedItem(null)
          fetchTransactions()
      } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus transaksi')
      } finally {
          setLoading(false)
      }
  }

  const openDelete = (item: Transaction) => {
      setSelectedItem(item)
      setDeleteModalOpen(true)
  }

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const handleCreate = async () => {
    if (!form.categoryId || form.amount <= 0 || !form.accountId) {
      toast.error('Mohon lengkapi data (Kategori, Akun, Jumlah)')
      return
    }

    setLoading(true)
    try {
       // 1. Upload Photos first
      let uploadedUrls: string[] = []
      if (photoUploadRef.current) {
          try {
              uploadedUrls = await photoUploadRef.current.uploadPhotos()
          } catch (e) {
              console.error('Upload failed', e)
              toast.error('Gagal mengupload foto bukti. Transaksi dibatalkan.')
              setLoading(false)
              return
          }
      }

      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...form,
            attachments: uploadedUrls
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch((): null => null)
        throw new Error(errData?.error || 'Gagal mencatat transaksi')
      }

      toast.success('Transaksi berhasil dicatat')
      setModalOpen(false)
      fetchTransactions()
      // reset form, including attachments
      setForm({
        type: 'EXPENSE',
        categoryId: '',
        accountId: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        description: '',
        attachments: []
      })
      if (photoUploadRef.current) photoUploadRef.current.resetPhotos()

    } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Gagal mencatat transaksi')
    } finally {
        setLoading(false) // Ensure loading is off in all cases
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Account Filter Banner */}
      {accountIdParam && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg flex items-center justify-between">
              <div className="flex items-center">
                  <div className="shrink-0 text-blue-500">
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                  </div>
                  <div className="ml-3">
                      <p className="text-sm text-blue-700 dark:text-blue-200">
                          Menampilkan transaksi untuk akun <strong>{accounts.find(a => a.id === accountIdParam)?.name || 'Unknown Account'}</strong>
                      </p>
                  </div>
              </div>
              <Button 
                variant="link"
                size="sm"
                onClick={() => router.push('/admin/finance/transactions')}
                className="flex items-center gap-1"
              >
                  <HiXCircle className="w-5 h-5" />
                  Hapus Filter
              </Button>
          </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Daftar Transaksi</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
               Pencatatan pemasukan dan pengeluaran manual.
            </p>
          </div>
          {canCreate && (
              <Button onClick={() => setModalOpen(true)}
              >
                  <HiPlus className="w-5 h-5 mr-2" />
                  Catat Transaksi
              </Button>
          )}
        </div>

        {/* Summary (Subtle) */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                 <p className="text-sm font-medium text-green-800 dark:text-green-300">Total Pemasukan</p>
                 <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(summary.income)}</p>
             </div>
             <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                 <p className="text-sm font-medium text-red-800 dark:text-red-300">Total Pengeluaran</p>
                 <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(summary.expense)}</p>
             </div>
             <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                 <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Saldo Akhir</p>
                 <p className={`text-lg font-bold ${summary.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(summary.balance)}</p>
             </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                   <label htmlFor="filter-site" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter Site</label>
                   <SiteFilter onSiteChange={setFilterSiteId} />
                </div>
                <div>
                   <label htmlFor="filter-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter Kategori</label>
                   <select 
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="">Semua Kategori</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dari Tanggal</label>
                    <input 
                        type="date" 
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sampai Tanggal</label>
                    <input 
                        type="date" 
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keterangan</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ref / PO</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Masuk (In)</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keluar (Out)</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                        <tr><td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</td></tr>
                    ) : data.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada transaksi di periode ini</td></tr>
                    ) : (
                        data.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                    {new Date(item.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{item.description}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">by {item.createdBy?.name || 'System'}</div>
                                    {item.attachments && item.attachments.length > 0 && (
                                        <div className="flex gap-2 mt-2 flex-wrap">
                                            {item.attachments.map((url: string, idx: number) => (
                                                <a 
                                                    key={idx} 
                                                    href={url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 transition-colors"
                                                >
                                                    <HiPaperClip className="w-3 h-3 mr-1" />
                                                    Bukti {idx + 1}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        item.type === 'INCOME' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                        {item.category?.name}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                    {item.purchaseOrder?.poNumber || item.referenceId || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600 dark:text-green-400">
                                    {item.type === 'INCOME' ? formatCurrency(item.amount) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600 dark:text-red-400">
                                    {item.type === 'EXPENSE' ? formatCurrency(item.amount) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {!item.purchaseOrder && canDelete && (
                                        <button
                                            onClick={() => openDelete(item)}
                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                            title="Hapus Transaksi Manual"
                                        >
                                           <HiTrash className="w-5 h-5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
                </table>
            </div>
      </div>
      </div>

       {/* Modal */}
       <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Catat Transaksi Manual"
            size="lg"
       >
            <div className="space-y-6">
                <div>
                    <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tipe Transaksi</span>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setForm({...form, type: 'INCOME'})}
                            className={`relative overflow-hidden flex flex-col items-center justify-center gap-3 p-4 border-2 rounded-xl transition-all duration-200 ${
                                form.type === 'INCOME' 
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                                    : 'border-gray-200 hover:border-green-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:bg-green-50/50'
                            }`}
                        >
                            <div className={`p-3 rounded-full ${form.type === 'INCOME' ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                </svg>
                            </div>
                            <span className="font-bold text-sm">Pemasukan</span>
                            {form.type === 'INCOME' && <div className="absolute top-0 right-0 w-2 h-full bg-green-500" />}
                        </button>

                        <button
                            type="button"
                            onClick={() => setForm({...form, type: 'EXPENSE'})}
                            className={`relative overflow-hidden flex flex-col items-center justify-center gap-3 p-4 border-2 rounded-xl transition-all duration-200 ${
                                form.type === 'EXPENSE' 
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' 
                                    : 'border-gray-200 hover:border-red-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:bg-red-50/50'
                            }`}
                        >
                            <div className={`p-3 rounded-full ${form.type === 'EXPENSE' ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                </svg>
                            </div>
                            <span className="font-bold text-sm">Pengeluaran</span>
                            {form.type === 'EXPENSE' && <div className="absolute top-0 right-0 w-2 h-full bg-red-500" />}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="tx-amount" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nominal (Rp) <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold select-none">Rp</span>
                                <input 
                                    id="tx-amount"
                                    type="number" 
                                    placeholder="0"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm font-bold text-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                                    value={form.amount || ''} 
                                    onChange={(e) => setForm({...form, amount: Number(e.target.value)})} 
                                />
                            </div>
                            {form.amount > 0 && (
                                <p className="mt-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                                    Bisa dibaca: {formatCurrency(form.amount)}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="tx-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tanggal <span className="text-red-500">*</span></label>
                            <input 
                                id="tx-date"
                                type="date" 
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" 
                                value={form.date} 
                                onChange={(e) => setForm({...form, date: e.target.value})} 
                            />
                        </div>
                    </div>

                    {/* Market Price Helper */}
                    {form.type === 'EXPENSE' && (
                        <div className="pt-2">
                           <details className="group">
                               <summary className="list-none cursor-pointer text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1.5 font-medium select-none bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800 w-max transition-colors">
                                   <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                   </svg>
                                   Butuh referensi harga? Cek Harga Pasar
                               </summary>
                               <div className="mt-3 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                   <MarketPriceCheck 
                                       initialKeyword={form.description} 
                                       onSelectPrice={(price) => setForm(prev => ({ ...prev, amount: price }))} 
                                   />
                               </div>
                           </details>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="tx-category" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kategori <span className="text-red-500">*</span></label>
                        <select 
                            id="tx-category"
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" 
                            value={form.categoryId} 
                            onChange={(e) => setForm({...form, categoryId: e.target.value})}
                        >
                            <option value="">-- Pilih Kategori --</option>
                            {categories
                                .filter(c => c.type === form.type) 
                                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                            }
                        </select>
                        {categories.filter(c => c.type === form.type).length === 0 && (
                            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                                <HiXCircle className="w-3.5 h-3.5" /> Belum ada kategori untuk tipe ini.
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="tx-account" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            {form.type === 'INCOME' ? 'Masuk ke Akun' : 'Sumber Dana'} <span className="text-red-500">*</span>
                        </label>
                        <select 
                            id="tx-account"
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                            value={form.accountId}
                            onChange={(e) => setForm({...form, accountId: e.target.value})}
                        >
                            <option value="">-- Pilih Akun --</option>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label htmlFor="tx-desc" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Keterangan Tambahan</label>
                    <textarea 
                        id="tx-desc"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none" 
                        rows={3}
                        value={form.description} 
                        onChange={(e) => setForm({...form, description: e.target.value})}
                        placeholder={form.type === 'INCOME' ? "Contoh: Penjualan Scrap, Pencairan Dana, dll" : "Contoh: Pembayaran Listrik, Belanja Rutin, dll"}
                    ></textarea>
                </div>

                <div>
                    <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                        Bukti Transaksi <span className="text-gray-400 font-normal">(Opsional)</span>
                    </span>
                    <div className="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 transition-colors hover:border-blue-400">
                        <PhotoUpload 
                            ref={photoUploadRef}
                            transactionType="finance-transaction"
                            maxPhotos={3}
                            transactionId="temp-transaction"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-5 mt-2 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                    <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                        Batal
                    </Button>
                    <Button type="button" loading={loading} onClick={handleCreate}>
                        Simpan Transaksi
                    </Button>
                </div>
            </div>
       </Modal>
      
      {/* Delete Confirmation Modal */}
      <ConfirmDialog
            open={deleteModalOpen}
            onCancel={() => setDeleteModalOpen(false)}
            onConfirm={handleDelete}
            title="Hapus Transaksi?"
            description={`Anda akan menghapus transaksi: ${selectedItem?.description} senilai ${selectedItem ? formatCurrency(selectedItem.amount) : 'Rp 0'}. Tindakan ini tidak dapat dibatalkan.`}
            confirmText={loading ? 'Menghapus...' : 'Hapus Transaksi'}
            cancelText="Batal"
      />
    </div>
  )
}
