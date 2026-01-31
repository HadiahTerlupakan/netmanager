'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { FiPlus } from 'react-icons/fi'
import { BarangTable } from '@/components/inventory/BarangTable'
import { InventoryStats } from '@/components/inventory/InventoryStats'
import { usePermission } from '@/hooks/use-permission'

export default function BarangPage() {
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('barang:create')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manajemen Barang
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola daftar barang dan stok inventory
          </p>
        </div>
        {canCreate && (
          <Link
            href="/admin/inventory/barang/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FiPlus className="h-4 w-4 mr-2" />
            Tambah Barang
          </Link>
        )}
      </div>

      <InventoryStats />

      {/* Barang Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Daftar Barang
          </h2>
        </div>
        <Suspense fallback={
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data barang...</p>
            </div>
          </div>
        }>
          <BarangTable />
        </Suspense>
      </div>
    </div>
  )
}