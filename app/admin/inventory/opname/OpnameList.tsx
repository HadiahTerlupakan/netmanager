'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiClipboard, FiList, FiPieChart, FiBarChart2 } from 'react-icons/fi'
import { StockOpnameRecorder } from '@/components/inventory/StockOpnameRecorder'
import { OpnameReportTable } from '@/components/inventory/OpnameReportTable'
import { OpnameForm } from '@/components/inventory/OpnameForm'
import { StockReport } from '@/components/inventory/StockReport'
import type { StockOpnameRecord, StockOpnameFormData } from '@/lib/types/inventory'
import { usePermission } from '@/hooks/use-permission'

export default function StockOpnamePage() {
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('opname:create')
  const canUpdate = hasPermission('opname:update')

  const [activeTab, setActiveTab] = useState<'report' | 'input' | 'history'>('report')
  const [showForm, setShowForm] = useState(false)
  const [editingOpname, setEditingOpname] = useState<StockOpnameRecord | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleEdit = (opname: StockOpnameRecord) => {
    setEditingOpname(opname)
    setShowForm(true)
  }

  const handleView = (opname: StockOpnameRecord) => {
    // Implement view modal or navigation
    console.log('View opname:', opname)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingOpname(null)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleRecorderSuccess = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/admin/inventory"
            className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiClipboard className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Stock Opname
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Laporan stok dan pencatatan stok fisik dengan breakdown kondisi
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('report')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'report'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
          >
            <FiPieChart className="inline mr-2 h-4 w-4" />
            Laporan Stok per Gudang
          </button>
          {canCreate && (
            <button
              onClick={() => setActiveTab('input')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'input'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              <FiClipboard className="inline mr-2 h-4 w-4" />
              Input Stock Opname
            </button>
          )}
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'history'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
          >
            <FiList className="inline mr-2 h-4 w-4" />
            Riwayat Opname
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'report' && (
        <StockReport />
      )}

      {activeTab === 'input' && (
        <div className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="shrink-0">
                <FiClipboard className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 flex items-center gap-2">
                  <FiBarChart2 className="w-4 h-4" /> Stock Opname - Pencatatan Stok Fisik:
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Pilih gudang yang akan di-opname</li>
                    <li>Sistem menampilkan stok saat ini di database</li>
                    <li>Input jumlah stok fisik yang Anda hitung di lapangan</li>
                    <li>Berikan breakdown kondisi aktual (Baik/Rusak/Bekas)</li>
                    <li>Sistem akan mengidentifikasi selisih antara stok sistem & fisik</li>
                    <li>Hanya item dengan selisih yang akan dicatat</li>
                  </ol>
                </div>
                <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
                  <strong>Note:</strong> Stock opname adalah pencatatan stok fisik aktual di lapangan untuk dibandingkan dengan stok sistem. PIC akan otomatis diisi dengan user yang sedang login.
                </div>
              </div>
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Input Stock Opname - Stok Fisik vs Sistem
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bandingkan hasil hitungan stok fisik dengan data stok sistem
              </p>
            </div>
            <div className="p-6">
              <StockOpnameRecorder onSuccess={handleRecorderSuccess} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <OpnameReportTable
            onEdit={canUpdate ? handleEdit : undefined}
            onView={handleView}
            refreshTrigger={refreshTrigger}
          />
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 backdrop-blur-sm transition-opacity"
              onClick={handleFormClose}
            ></div>

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 ease-out scale-100 opacity-100">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingOpname ? 'Edit Stock Opname' : 'Manual Entry Stock Opname'}
                </h3>
                <button
                  onClick={handleFormClose}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <OpnameForm
                  initialData={editingOpname as unknown as StockOpnameFormData || undefined}
                  onClose={handleFormClose}
                  onSuccess={handleFormClose}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}