'use client'

import React from 'react'
import Link from 'next/link'
import { 
  HiOutlineShoppingBag, 
  HiOutlineDocumentText, 
  HiOutlinePresentationChartBar,
  HiOutlineCurrencyDollar,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClock,
  HiChevronRight
} from 'react-icons/hi2'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import clsx from 'clsx'

interface ProcurementStats {
    totalPOs: number
    draftPOs: number
    activePOs: number
    monthlySpending: number
}

interface RecentPO {
    id: string
    poNumber: string
    status: string
    grandTotal: number
    supplier?: {
        name: string
    } | null
    createdAt: string
}

interface ProcurementIndexClientProps {
    stats: ProcurementStats
    recentPOs: RecentPO[]
}

export function ProcurementIndexClient({ stats, recentPOs }: ProcurementIndexClientProps) {

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
  }

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'DRAFT': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          case 'ORDERED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
          case 'PARTIAL': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
          case 'RECEIVED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
          case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          default: return 'bg-gray-100 text-gray-800'
      }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Procurement Dashboard</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Ringkasan aktivitas pembelian dan pengadaan.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Spending */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <HiOutlineCurrencyDollar className="w-20 h-20 text-emerald-600" />
              </div>
              <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                       <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                           <HiOutlineCurrencyDollar className="w-5 h-5" />
                       </div>
                       <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Belanja Bulan Ini</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(stats.monthlySpending)}
                  </div>
              </div>
          </div>

          {/* Active POs */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <HiOutlineClipboardDocumentCheck className="w-20 h-20 text-blue-600" />
              </div>
              <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                       <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                           <HiOutlineClipboardDocumentCheck className="w-5 h-5" />
                       </div>
                       <span className="text-sm font-medium text-gray-500 dark:text-gray-400">PO Aktif (Ordered)</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.activePOs} <span className="text-sm font-normal text-gray-500">Pesanan</span>
                  </div>
              </div>
          </div>

          {/* Draft POs */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <HiOutlineClock className="w-20 h-20 text-orange-600" />
              </div>
              <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                       <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600 dark:text-orange-400">
                           <HiOutlineClock className="w-5 h-5" />
                       </div>
                       <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Draft PO</span>
                  </div>
                   <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.draftPOs} <span className="text-sm font-normal text-gray-500">Draft</span>
                  </div>
              </div>
          </div>

          {/* Total POs */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <HiOutlineDocumentText className="w-20 h-20 text-indigo-600" />
              </div>
              <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                       <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                           <HiOutlineDocumentText className="w-5 h-5" />
                       </div>
                       <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Purchase Orders</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.totalPOs}
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity Section */}
          <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pesanan Terakhir</h2>
                  <Link href="/admin/procurement/purchase-orders" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1">
                      Lihat Semua <HiChevronRight className="w-4 h-4" />
                  </Link>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PO Number</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {recentPOs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        Belum ada pesanan pembelian.
                                    </td>
                                </tr>
                            ) : (
                                recentPOs.map((po) => (
                                    <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{po.poNumber}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">{po.supplier?.name || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {format(new Date(po.createdAt), 'dd MMM yyyy', { locale: id })}
                                        </td>
                                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                                            {formatCurrency(Number(po.grandTotal))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", getStatusColor(po.status))}>
                                                {po.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
              </div>
          </div>

          {/* Quick Actions / Menu Section */}
          <div className="space-y-6">
               <h2 className="text-lg font-bold text-gray-900 dark:text-white">Akses Cepat</h2>
                <div className="grid grid-cols-1 gap-4">
                     {/* Purchase Order */}
                    <Link 
                    href="/admin/procurement/purchase-orders"
                    className="group relative p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-4"
                    >
                         <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shrink-0">
                            <HiOutlineDocumentText className="w-6 h-6" />
                        </div>
                        <div>
                             <h3 className="text-sm font-bold text-gray-900 dark:text-white">Purchase Orders</h3>
                             <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Kelola pesanan pembelian</p>
                        </div>
                         <HiChevronRight className="w-5 h-5 text-gray-400 ml-auto group-hover:text-blue-600 transition-colors" />
                    </Link>

                    {/* Market Price Analysis */}
                    <Link 
                    href="/admin/procurement/market-price"
                    className="group relative p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-4"
                    >
                         <div className="w-12 h-12 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shrink-0">
                            <HiOutlinePresentationChartBar className="w-6 h-6" />
                        </div>
                        <div>
                             <h3 className="text-sm font-bold text-gray-900 dark:text-white">Analisa Harga</h3>
                             <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Monitoring harga pasar</p>
                        </div>
                        <HiChevronRight className="w-5 h-5 text-gray-400 ml-auto group-hover:text-purple-600 transition-colors" />
                    </Link>

                     {/* Future Features Wrapper */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 flex items-center gap-4 opacity-60">
                         <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center shrink-0">
                            <HiOutlineShoppingBag className="w-6 h-6" />
                        </div>
                        <div>
                             <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Supplier Mgmt</h3>
                             <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Segera Hadir</p>
                        </div>
                    </div>
                </div>
          </div>
      </div>
    </div>
  )
}
