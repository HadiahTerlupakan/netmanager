'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiDownload, FiPlus } from 'react-icons/fi'
import { MasukForm } from '@/components/inventory/MasukForm'
import { MasukTable } from '@/components/inventory/MasukTable'
import { DetailMasukModal } from '@/components/inventory/DetailMasukModal'

interface BarangMasuk {
  id: string
  barangId: string
  gudangId: string
  jumlah: number
  kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
  keterangan: string | null
  tanggal: string
  createdAt: string
  employeeId?: string | null
  fotoBukti: string[]
  fotoMetadata?: any
  barang: {
    id: string
    kode: string
    nama: string
    satuan: string
  }
  gudang: {
    id: string
    kode: string
    nama: string
  }
  user?: {
    id: string
    name: string | null
    email: string
  } | null
}

export default function BarangMasukPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingMasuk, setEditingMasuk] = useState<BarangMasuk | null>(null)
  const [viewingMasuk, setViewingMasuk] = useState<BarangMasuk | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleEdit = (masuk: BarangMasuk) => {
    setEditingMasuk(masuk)
    setShowForm(true)
  }

  const handleView = (masuk: BarangMasuk) => {
    setViewingMasuk(masuk)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingMasuk(null)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleViewClose = () => {
    setViewingMasuk(null)
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
            <FiDownload className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Barang Masuk
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kelola catatan barang yang masuk ke gudang
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <FiPlus className="h-4 w-4 mr-2" />
          Barang Masuk
        </button>
      </div>

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
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 ease-out scale-100 opacity-100">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingMasuk ? 'Edit Barang Masuk' : 'Catat Barang Masuk'}
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
                <MasukForm
                  initialData={editingMasuk}
                  onClose={handleFormClose}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Riwayat Barang Masuk
          </h2>
        </div>
        <div className="p-6">
          <MasukTable
            onEdit={handleEdit}
            onView={handleView}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>

      {/* Detail Modal */}
      <DetailMasukModal
        masuk={viewingMasuk}
        isOpen={!!viewingMasuk}
        onClose={handleViewClose}
        onEdit={handleEdit}
      />
    </div>
  )
}