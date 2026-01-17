import { AssetTable } from '@/components/inventory/assets/AssetTable'
import Link from 'next/link'
import { FiPlus } from 'react-icons/fi'

export default function AssetsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manajemen Aset Tetap
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola aset tetap, penyusutan, dan nilai buku
          </p>
        </div>
        <Link
          href="/admin/inventory/assets/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FiPlus className="mr-2 -ml-1 h-5 w-5" />
          Tambah Aset
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <AssetTable />
      </div>
    </div>
  )
}
