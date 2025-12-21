import Link from 'next/link'
import { JoinboxForm } from '@/components/closure/JoinboxForm'

export function ClosureNewClient() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah JOINbox</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Buat data JOINbox/closure baru.</p>
        </div>
        <Link href="/admin/ftth/closure" className="text-sm text-gray-600 dark:text-gray-400">Kembali</Link>
      </div>

      <JoinboxForm mode="create" />
    </div>
  )
}


