import { Suspense } from 'react'
import { BarangTable } from '@/components/inventory/BarangTable'
import { QuickActions } from '@/components/inventory/QuickActions'
import { StatsCards } from '@/components/inventory/StatsCards'

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Inventory Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola barang dan stok gudang
          </p>
        </div>
        <QuickActions />
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Barang Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Daftar Barang
          </h2>
        </div>
        <Suspense fallback={<div>Loading...</div>}>
          <BarangTable />
        </Suspense>
      </div>
    </div>
  )
}