'use client'

import { useState } from 'react'
import { HiOutlineDocumentText, HiMagnifyingGlass, HiOutlineExclamationCircle } from 'react-icons/hi2'
import clsx from 'clsx'
import type { Invoice } from '@/types'

interface ReceivablesClientProps {
  initialData: Invoice[]
  hideHeader?: boolean
}

export default function ReceivablesClient({ initialData, hideHeader = false }: ReceivablesClientProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
  }

  // Filter Logic
  const filteredInvoices = initialData.filter(inv => {
    const searchLower = searchTerm.toLowerCase()
    return (
        inv.invoiceNumber.toLowerCase().includes(searchLower) ||
        inv.pelanggan?.nama.toLowerCase().includes(searchLower)
    )
  })

  // Stats Calculation
  const totalReceivables = filteredInvoices.reduce((sum, inv) => {
    const remaining = Number(inv.totalAmount) - Number(inv.paidAmount)
    return sum + remaining
  }, 0)

  const overdueCount = filteredInvoices.filter(inv => inv.status === 'OVERDUE').length

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      {!hideHeader && (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Piutang Usaha (AR)</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
               Daftar tagihan pelanggan yang belum lunas (Accounts Receivable).
            </p>
          </div>
        </div>
          
        {/* Stats Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Total Piutang Card */}
             <div className="bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-xl p-5 border border-emerald-100 dark:border-emerald-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-emerald-100 dark:bg-emerald-800 rounded-full opacity-20 blur-xl"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-200 mr-4">
                        <HiOutlineDocumentText className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300">Total Piutang (Belum Terbayar)</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalReceivables)}</p>
                    </div>
                </div>
             </div>

             {/* Overdue Card */}
             <div className="bg-linear-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 rounded-xl p-5 border border-orange-100 dark:border-orange-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-orange-100 dark:bg-orange-800 rounded-full opacity-20 blur-xl"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-800 text-orange-600 dark:text-orange-200 mr-4">
                        <HiOutlineExclamationCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-300">Invoice Jatuh Tempo</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{overdueCount} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">Tagihan</span></p>
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
                    placeholder="Cari No Invoice atau Pelanggan..." 
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
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice #</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pelanggan</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tgl Terbit</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jatuh Tempo</th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Tagihan</th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sisa Pembayaran</th>
                        <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredInvoices.length === 0 && (
                        <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            <div className="flex flex-col items-center justify-center">
                                <HiOutlineDocumentText className="w-12 h-12 text-gray-300 mb-2" />
                                <p>Tidak ada data piutang ditemukan</p>
                            </div>
                        </td>
                        </tr>
                    )}
                    {filteredInvoices.map((inv) => {
                        const remaining = Number(inv.totalAmount) - Number(inv.paidAmount)
                        const isOverdue = new Date(inv.dueDate) < new Date() && remaining > 0

                        return (
                        <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                                    {inv.invoiceNumber}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{inv.pelanggan?.nama || '-'}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{inv.pelanggan?.idPelanggan}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {new Date(inv.issueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                <div className={clsx("flex items-center gap-1", isOverdue ? "text-red-600 font-medium" : "")}>
                                     {new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                     {isOverdue && <HiOutlineExclamationCircle className="w-4 h-4" />}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white font-mono">
                                {formatCurrency(Number(inv.totalAmount))}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600 dark:text-red-400 font-mono">
                                {formatCurrency(remaining)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={clsx(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                    inv.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' : 
                                    inv.status === 'OVERDUE' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' :
                                    inv.status === 'SENT' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' :
                                    'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                                )}>
                                    {inv.status === 'SENT' ? 'Terkirim' : 
                                     inv.status === 'OVERDUE' ? 'Jatuh Tempo' : 
                                     inv.status === 'PAID' ? 'Lunas' : inv.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                    onClick={() => alert('Fitur Detail/Remind belum tersedia')} // Placeholder
                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                                >
                                    Detail
                                </button>
                            </td>
                        </tr>
                        )
                    })}
                </tbody>
            </table>
          </div>
      </div>
    </div>
  )
}
