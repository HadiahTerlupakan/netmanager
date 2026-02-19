'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { HiOutlineBanknotes, HiOutlineBuildingLibrary, HiOutlineCreditCard, HiOutlineWallet } from 'react-icons/hi2'

interface AddAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddAccountModal({ isOpen, onClose, onSuccess }: AddAccountModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'BANK',
    accountNumber: '',
    description: '',
    initialBalance: 0
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!formData.name) throw new Error('Nama akun wajib diisi')

      const res = await fetch('/api/finance/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Gagal membuat akun')
      }

      onSuccess()
      onClose()
      setFormData({
        name: '',
        type: 'BANK',
        accountNumber: '',
        description: '',
        initialBalance: 0
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'BANK': return <HiOutlineBuildingLibrary className="w-5 h-5 text-blue-500" />
          case 'CASH': return <HiOutlineBanknotes className="w-5 h-5 text-green-500" />
          case 'EWALLET': return <HiOutlineCreditCard className="w-5 h-5 text-purple-500" />
          default: return <HiOutlineWallet className="w-5 h-5 text-gray-500" />
      }
  }

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="Tambah Akun Keuangan"
        description="Buat akun baru untuk pencatatan kas, bank, atau e-wallet."
        size="lg"
    >
        <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-100 dark:border-red-900/30 flex items-center gap-2">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Nama Akun <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        placeholder="Contoh: Bank BCA, Kas Kecil Operasional"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Tipe Akun <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-3 pointer-events-none">
                                {getTypeIcon(formData.type)}
                            </div>
                            <select 
                                value={formData.type}
                                onChange={e => setFormData({...formData, type: e.target.value})}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none"
                                required
                            >
                                <option value="BANK">Bank Transfer</option>
                                <option value="CASH">Tunai / Kas</option>
                                <option value="EWALLET">E-Wallet (OVO, GoPay, dll)</option>
                                <option value="OTHER">Lainnya</option>
                            </select>
                            <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                     </div>
                     
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            No. Rekening (Opsional)
                        </label>
                        <input 
                            type="text"
                            value={formData.accountNumber}
                            onChange={e => setFormData({...formData, accountNumber: e.target.value})}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            placeholder="Nomor rekening bank"
                        />
                     </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Keterangan
                    </label>
                    <textarea 
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        rows={2}
                        placeholder="Deskripsi singkat penggunaan akun ini..."
                    />
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50 mt-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Saldo Awal
                    </label>
                     <div className="relative">
                        <span className="absolute left-4 top-2.5 text-gray-500 font-medium">Rp</span>
                        <input 
                            type="number"
                            value={formData.initialBalance || ''}
                            onChange={e => setFormData({...formData, initialBalance: Number(e.target.value)})}
                            className="w-full pl-12 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400" 
                            placeholder="0"
                        />
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-start gap-1">
                        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Sebaiknya biarkan 0 jika Anda ingin mencatat saldo awal melalui transaksi pemasukan agar tercatat di histori mutasi.</span>
                    </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button 
                        type="button" 
                        variant="outline"
                        onClick={onClose}
                    >
                        Batal
                    </Button>
                    <Button type="submit" 
                        loading={loading}
                    >
                        Simpan Akun
                    </Button>
                </div>
            </form>
        </div>
    </Modal>
  )
}
