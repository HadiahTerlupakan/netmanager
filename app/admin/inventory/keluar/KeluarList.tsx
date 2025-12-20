'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiUpload, FiPlus } from 'react-icons/fi'
import { KeluarForm } from '@/components/inventory/KeluarForm'
import { KeluarTable } from '@/components/inventory/KeluarTable'
import { DetailKeluarModal } from '@/components/inventory/DetailKeluarModal'

interface BarangKeluar {
  id: string
  barangId: string
  gudangId: string
  jumlah: number
  kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
  isHilang?: boolean
  keterangan: string | null
  tanggal: string
  createdAt: string
  employeeId?: string | null
  purpose?: string | null
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

export default function BarangKeluarPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingKeluar, setEditingKeluar] = useState<BarangKeluar | null>(null)
  const [viewingKeluar, setViewingKeluar] = useState<BarangKeluar | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleEdit = (keluar: BarangKeluar) => {
    setEditingKeluar(keluar)
    setShowForm(true)
  }

  const handleView = (keluar: BarangKeluar) => {
    setViewingKeluar(keluar)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingKeluar(null)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleViewClose = () => {
    setViewingKeluar(null)
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
            <FiUpload className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Barang Keluar
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kelola catatan barang yang keluar dari gudang
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          <FiPlus className="h-4 w-4 mr-2" />
          Barang Keluar
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
                  {editingKeluar ? 'Edit Barang Keluar' : 'Catat Barang Keluar'}
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
                <KeluarForm
                  initialData={editingKeluar}
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
            Riwayat Barang Keluar
          </h2>
        </div>
        <div className="p-6">
          <KeluarTable
            onEdit={handleEdit}
            onView={handleView}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>

      {/* Detail Modal */}
      <DetailKeluarModal
        keluar={viewingKeluar}
        isOpen={!!viewingKeluar}
        onClose={handleViewClose}
        onEdit={handleEdit}
      />
    </div>
  )
}