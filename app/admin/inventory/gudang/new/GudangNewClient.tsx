'use client'

import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import { GudangForm } from '@/components/inventory/GudangForm'

export function ClientComponent() {
  const handleSuccess = () => {
    // Redirect back to gudang list
    window.location.href = '/admin/inventory/gudang'
  }

  const handleCancel = () => {
    // Go back to previous page
    window.history.back()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Link
          href="/admin/inventory/gudang"
          className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tambah Gudang
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tambah lokasi penyimpanan barang baru
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <GudangForm
            onSubmit={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  )
}