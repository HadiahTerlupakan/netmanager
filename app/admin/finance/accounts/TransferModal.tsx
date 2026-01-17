'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { HiOutlineArrowRight } from 'react-icons/hi2'
import clsx from 'clsx'

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  accounts: any[]
}

export default function TransferModal({ isOpen, onClose, onSuccess, accounts }: TransferModalProps) {
  const [formData, setFormData] = useState({
    sourceAccountId: '',
    destinationAccountId: '',
    categoryId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  })
  
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
        fetchCategories()
        // Default to first account if not selected
        if (!formData.sourceAccountId && accounts.length > 0) {
            setFormData(prev => ({ ...prev, sourceAccountId: accounts[0].id }))
        }
    }
  }, [isOpen])

  const fetchCategories = async () => {
      try {
          const res = await fetch('/api/finance/categories')
          if (res.ok) {
              const data = await res.json()
              setCategories(data)
          }
      } catch (e) {
          console.error("Failed to fetch categories", e)
      }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (formData.sourceAccountId === formData.destinationAccountId) {
          throw new Error('Akun asal dan tujuan tidak boleh sama')
      }
      if (Number(formData.amount) <= 0) {
          throw new Error('Jumlah transfer harus lebih dari 0')
      }

      const res = await fetch('/api/finance/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...formData,
            amount: Number(formData.amount)
        })
      })

      if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Gagal melakukan transfer')
      }

      onSuccess()
      onClose()
      // Reset Optional
      setFormData({
        sourceAccountId: '',
        destinationAccountId: '',
        categoryId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatBalance = (bal: number) => {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(bal)
  }

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="Mutasi Saldo"
        description="Pindahkan dana antar akun keuangan perusahaan."
        size="lg"
    >
        <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-100 dark:border-red-900/30 flex items-center gap-2">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Transfer Logic Box */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-700/50 relative">
                    {/* Arrow Icon Indicator */}
                     <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white dark:bg-gray-700 rounded-full shadow border border-gray-100 dark:border-gray-600 items-center justify-center text-gray-400 dark:text-gray-300 z-10 hidden md:flex">
                        <HiOutlineArrowRight className="w-4 h-4" />
                     </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                         {/* Source */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dari Akun</label>
                            <select 
                                value={formData.sourceAccountId}
                                onChange={e => setFormData({...formData, sourceAccountId: e.target.value})}
                                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                required
                            >
                                <option value="">Pilih Akun Sumber</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                            {formData.sourceAccountId && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Saldo: <span className="font-medium text-gray-700 dark:text-gray-300">{formatBalance(accounts.find(a => a.id === formData.sourceAccountId)?.balance || 0)}</span>
                                </p>
                            )}
                        </div>

                        {/* Destination */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ke Akun</label>
                            <select 
                                value={formData.destinationAccountId}
                                onChange={e => setFormData({...formData, destinationAccountId: e.target.value})}
                                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                required
                            >
                                <option value="">Pilih Akun Tujuan</option>
                                {accounts.filter(a => a.id !== formData.sourceAccountId).map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                            {formData.destinationAccountId && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Saldo: <span className="font-medium text-gray-700 dark:text-gray-300">{formatBalance(accounts.find(a => a.id === formData.destinationAccountId)?.balance || 0)}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Jumlah Transfer</label>
                        <div className="relative">
                            <span className="absolute left-4 top-2.5 text-gray-500 font-medium">Rp</span>
                            <input 
                                type="number"
                                value={formData.amount}
                                onChange={e => setFormData({...formData, amount: e.target.value})}
                                className="w-full pl-12 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg font-semibold"
                                placeholder="0"
                                min="1"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tanggal Transaksi</label>
                        <input 
                            type="date"
                            value={formData.date}
                            onChange={e => setFormData({...formData, date: e.target.value})}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Kategori</label>
                        <select 
                            value={formData.categoryId}
                            onChange={e => setFormData({...formData, categoryId: e.target.value})}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                            required
                        >
                            <option value="">Pilih Kategori</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Keterangan</label>
                        <input 
                            type="text"
                            value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Catatan..."
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Batal
                    </button>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/30 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Memproses...
                            </>
                        ) : (
                            <>
                                <HiOutlineArrowRight className="w-4 h-4" />
                                Transfer Sekarang
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    </Modal>
  )
}
