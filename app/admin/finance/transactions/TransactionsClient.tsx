'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HiPlus, HiTrash, HiXCircle, HiPaperClip } from 'react-icons/hi2'
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
      setData(json)

      // Calculate Summary on Client for current filtered view
      const income = json.filter((t: Transaction) => t.type === 'INCOME').reduce((acc: number, t: Transaction) => acc + t.amount, 0)
      const expense = json.filter((t: Transaction) => t.type === 'EXPENSE').reduce((acc: number, t: Transaction) => acc + t.amount, 0)
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
              <button 
                onClick={() => router.push('/admin/finance/transactions')}
                className="text-sm text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 flex items-center gap-1 font-medium"
              >
                  <HiXCircle className="w-5 h-5" />
                  Hapus Filter
              </button>
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
              <button
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => setModalOpen(true)}
              >
                  <HiPlus className="w-5 h-5 mr-2" />
                  Catat Transaksi
              </button>
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
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter Site</label>
                   <SiteFilter onSiteChange={setFilterSiteId} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter Kategori</label>
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
            <div className="space-y-5">
                <div className="form-control">
                    <label className="label font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Tipe Transaksi</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div 
                            onClick={() => setForm({...form, type: 'INCOME'})}
                            className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                                form.type === 'INCOME' 
                                    ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-400 dark:text-green-300 ring-1 ring-green-500' 
                                    : 'bg-white border-gray-200 hover:border-green-300 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                            }`}
                        >
                            <div className={`p-2 rounded-full ${form.type === 'INCOME' ? 'bg-green-200 dark:bg-green-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                </svg>
                            </div>
                            <span className="font-semibold text-sm">Pemasukan</span>
                        </div>

                        <div 
                            onClick={() => setForm({...form, type: 'EXPENSE'})}
                            className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                                form.type === 'EXPENSE' 
                                    ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30 dark:border-red-400 dark:text-red-300 ring-1 ring-red-500' 
                                    : 'bg-white border-gray-200 hover:border-red-300 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                            }`}
                        >
                            <div className={`p-2 rounded-full ${form.type === 'EXPENSE' ? 'bg-red-200 dark:bg-red-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                </svg>
                            </div>
                            <span className="font-semibold text-sm">Pengeluaran</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                        <label className="label font-medium text-sm text-gray-700 dark:text-gray-300">Kategori</label>
                        <select 
                            className="select select-bordered w-full bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
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
                            <span className="text-xs text-red-500 mt-1">Belum ada kategori untuk tipe ini.</span>
                        )}
                    </div>

                    <div className="form-control">
                     <label className="label font-medium text-sm text-gray-700 dark:text-gray-300">
                        {form.type === 'INCOME' ? 'Masuk ke Akun' : 'Sumber Dana (Bayar Pakai)'}
                     </label>
                     <select 
                         className="select select-bordered w-full bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                         value={form.accountId}
                         onChange={(e) => setForm({...form, accountId: e.target.value})}
                     >
                         <option value="">-- Pilih Akun --</option>
                         {accounts.map(a => (
                             <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
                         ))}
                     </select>
                 </div>

                 <div className="form-control">
                        <label className="label font-medium text-sm text-gray-700 dark:text-gray-300">Tanggal</label>
                        <input 
                            type="date" 
                            className="input input-bordered w-full bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            value={form.date} 
                            onChange={(e) => setForm({...form, date: e.target.value})} 
                        />
                    </div>
                </div>

                <div className="form-control">
                    <label className="label font-medium text-sm text-gray-700 dark:text-gray-300">Jumlah (Rp)</label>
                     <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                        <input 
                            type="number" 
                            className="input input-bordered w-full pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            value={form.amount} 
                            onChange={(e) => setForm({...form, amount: Number(e.target.value)})} 
                        />
                    </div>

                {/* Market Price Helper */}
                {form.type === 'EXPENSE' && (
                    <div className="mb-4">
                       <details className="group">
                           <summary className="list-none cursor-pointer text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium select-none">
                               <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                               </svg>
                               Butuh referensi harga? Cek Harga Pasar
                           </summary>
                           <div className="mt-2">
                               <MarketPriceCheck 
                                   initialKeyword={form.description} 
                                   onSelectPrice={(price) => setForm(prev => ({ ...prev, amount: price }))} 
                               />
                           </div>
                       </details>
                    </div>
                )}
                </div>

                <div className="form-control">
                    <label className="label font-medium text-sm text-gray-700 dark:text-gray-300">Keterangan</label>
                    <textarea 
                        className="textarea textarea-bordered h-24 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={form.description} 
                        onChange={(e) => setForm({...form, description: e.target.value})}
                        placeholder="Contoh: Pembayaran Listrik, Penjualan Scrap, dll"
                    ></textarea>
                </div>

                {/* Photo Upload Section */}
                <div className="form-control">
                    <label className="label font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Upload Bukti Transaksi (Opsional)
                    </label>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <PhotoUpload 
                            ref={photoUploadRef}
                            transactionType="finance-transaction"
                            maxPhotos={3}
                            transactionId="temp-transaction" // Provide a placeholder ID, will be handled by upload endpoint
                        />
                    </div>
                </div>

                <div className="modal-action pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button className="btn btn-ghost mr-2" onClick={() => setModalOpen(false)}>Batal</button>
                    <button className="btn btn-primary px-8" onClick={handleCreate} disabled={loading}>
                        {loading ? <span className="loading loading-spinner"></span> : 'Simpan Transaksi'}
                    </button>
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
