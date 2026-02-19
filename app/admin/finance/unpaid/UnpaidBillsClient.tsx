'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiOutlineBanknotes, HiMagnifyingGlass } from 'react-icons/hi2'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import type { Category, Account, PurchaseOrder } from '@/types'

interface UnpaidBillsClientProps {
  initialData: PurchaseOrder[]
  categories: Category[]
  accounts: Account[]
  hideHeader?: boolean
}

export default function UnpaidBillsClient({ initialData, categories, accounts, hideHeader = false }: UnpaidBillsClientProps) {
  const router = useRouter()
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Form State
  const [amount, setAmount] = useState<number>(0)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [paidFromAccountId, setPaidFromAccountId] = useState('')

  const openPaymentModal = (po: PurchaseOrder) => {
    setSelectedPo(po)
    setAmount(po.totalAmount) // Default full payment
    setCategoryId('')
    setPaidFromAccountId('')
    setNotes('')
    setDate(new Date().toISOString().split('T')[0])
  }

  const handlePay = async () => {
    if (!selectedPo) return
    
    if (!categoryId) {
      toast.error('Pilih kategori transaksi')
      return
    }
    if (!paidFromAccountId) {
      toast.error('Pilih sumber dana (akun)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/finance/pay-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poId: selectedPo.id,
          date,
          amount: Number(amount),
          categoryId,
          notes,
          paidFromAccountId
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch((): null => null)
        throw new Error(errData?.error || 'Gagal memproses pembayaran')
      }

      toast.success('Pembayaran PO berhasil dicatat')
      router.refresh()
      setSelectedPo(null)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Gagal memproses pembayaran')
    } finally {
      setLoading(false)
    }
  }

  // Filter Logic
  const filteredPos = initialData.filter(po => {
    const searchLower = searchTerm.toLowerCase()
    return (
        po.poNumber.toLowerCase().includes(searchLower) ||
        po.supplier?.name.toLowerCase().includes(searchLower)
    )
  })

  // Stats Calculation
  const totalUnpaid = filteredPos.reduce((sum, po) => {
    const paid = po.transactions.reduce((acc: number, curr) => acc + curr.amount, 0)
    const target = po.grandTotal > 0 ? po.grandTotal : po.totalAmount
    return sum + (target - paid)
  }, 0)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      {!hideHeader && (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Hutang Usaha (AP)</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
               Daftar tagihan pembelian yang perlu dibayar ke supplier (Account Payable).
            </p>
          </div>
        </div>
          
        {/* Simple Stats Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Total Hutang Card */}
             <div className="bg-linear-to-r from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 rounded-xl p-5 border border-red-100 dark:border-red-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-red-100 dark:bg-red-800 rounded-full opacity-20 blur-xl"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-3 rounded-full bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-200 mr-4">
                        <HiOutlineBanknotes className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-red-600 dark:text-red-300">Total Belum Dibayar</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalUnpaid)}</p>
                    </div>
                </div>
             </div>
        </div>
      </div>
      )}


      {/* Main Content */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
          {/* Toolbar */}
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <HiMagnifyingGlass className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                    type="text" 
                    placeholder="Cari PO atau Supplier..." 
                    className="block w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {/* Future: Add Filters for Status or Date Range here */}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PO Number</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total (DPP)</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PPN</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Grand Total</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sudah Bayar</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sisa Tagihan</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredPos.length === 0 && (
                        <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            <div className="flex flex-col items-center justify-center">
                                <HiOutlineBanknotes className="w-12 h-12 text-gray-300 mb-2" />
                                <p>Tidak ada tagihan yang ditemukan</p>
                            </div>
                        </td>
                        </tr>
                    )}
                    {filteredPos.map((po) => {
                        const paidAmount = po.transactions.reduce((acc: number, curr) => acc + curr.amount, 0)
                        const targetAmount = po.grandTotal > 0 ? po.grandTotal : po.totalAmount
                        const remaining = targetAmount - paidAmount

                        return (
                        <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">{po.poNumber}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(po.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{po.supplier?.name || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {formatCurrency(po.totalAmount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {po.ppnAmount > 0 ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                        {po.ppnRate}%
                                    </span>
                                ) : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white font-mono">
                                {formatCurrency(targetAmount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-mono">
                                {formatCurrency(paidAmount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 font-bold font-mono">
                                {formatCurrency(remaining)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={clsx(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                    po.paymentStatus === 'PAID' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' : 
                                    po.paymentStatus === 'PARTIAL' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' : 
                                    'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                )}>
                                    {po.paymentStatus === 'UNPAID' ? 'Belum Bayar' : po.paymentStatus === 'PARTIAL' ? 'Parsial' : 'Lunas'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Button 
                                    variant="link"
                                    size="sm"
                                    onClick={() => openPaymentModal(po)}
                                    disabled={remaining <= 100}
                                >
                                    Bayar
                                </Button>
                            </td>
                        </tr>
                        )
                    })}
                </tbody>
            </table>
          </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={!!selectedPo}
        onClose={() => setSelectedPo(null)}
        title="Proses Pembayaran"
        size="lg"
      >
           {/* Custom Header Content inside body if needed, or just rely on title */}
          {selectedPo && (
            <div className="space-y-6">
              {/* Premium Summary Card */}
              <div className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-5 rounded-xl border border-blue-100 dark:border-blue-800 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-blue-100 dark:bg-blue-800 rounded-full opacity-20 blur-xl"></div>
                 <div className="flex justify-between items-start relative z-10">
                    <div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wider mb-1">Nomor PO</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{selectedPo.poNumber}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{selectedPo.supplier?.name}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wider mb-1">Total Tagihan</div>
                        <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-400">
                            {formatCurrency(selectedPo.grandTotal > 0 ? selectedPo.grandTotal : selectedPo.totalAmount)}
                        </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="font-medium text-sm text-gray-700 dark:text-gray-300">Tanggal Bayar</label>
                    <input 
                        type="date" 
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-medium text-sm text-gray-700 dark:text-gray-300">Jumlah Bayar</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                        <input 
                            type="number" 
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-bold text-lg" 
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                        />
                    </div>
                  </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-gray-700 dark:text-gray-300">
                    Kategori (Chart of Account)
                </label>
                <div className="relative">
                    <select 
                        className="w-full px-4 py-2 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-all"
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                    >
                        <option value="">-- Pilih Kategori --</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-400">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-gray-700 dark:text-gray-300">
                    Sumber Dana (Bayar Pakai)
                </label>
                <div className="relative">
                    <select 
                        className="w-full px-4 py-2 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-all"
                        value={paidFromAccountId}
                        onChange={(e) => setPaidFromAccountId(e.target.value)}
                    >
                        <option value="">-- Pilih Akun --</option>
                        {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
                        ))}
                    </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-400">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-gray-700 dark:text-gray-300">Catatan / Referensi</label>
                <textarea 
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-24 resize-none" 
                    placeholder="Contoh: Transfer Bank BCA - Ref 12345"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700 mt-2">
                 <Button 
                    variant="ghost"
                    onClick={() => setSelectedPo(null)}
                >
                    Batal
                </Button>
                 <Button loading={loading}
                    onClick={handlePay}
                    className="gap-2"
                >
                    Konfirmasi Pembayaran
                </Button>
              </div>
            </div>
          )}
      </Modal>
    </div>
  )
}
