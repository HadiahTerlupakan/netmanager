import Link from 'next/link'
import { KmzList } from '@/components/kmz/KmzList'

export default function KmzPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Manajemen File KMZ</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Kelola file KMZ untuk ditampilkan di Topology Map.
          </p>
        </div>
        <Link
          href="/admin/ftth/kmz/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Tambah Baru
        </Link>
      </div>

      <KmzList />
    </div>
  )
}

