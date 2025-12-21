import Link from 'next/link'
import { KmzForm } from '@/components/kmz/KmzForm'

export function ClientComponent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Upload File KMZ</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload file KMZ baru untuk ditampilkan di Topology Map.
          </p>
        </div>
        <Link
          href="/admin/ftth/kmz"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          ← Kembali
        </Link>
      </div>

      <KmzForm />
    </div>
  )
}

