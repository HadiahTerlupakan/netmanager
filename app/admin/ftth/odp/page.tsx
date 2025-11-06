import Link from 'next/link'
import { getOdpRepository } from '@/lib/repositories'
import { OdpActions } from '@/components/odp/OdpActions'

type Odp = {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  createdAt: string
}

export default async function ODPPage() {
  const repo = getOdpRepository()
  const rows = await repo.findAll()
  const odps: Odp[] = rows.map((o: any) => ({
    id: o.id,
    name: o.name,
    location: o.location,
    notes: o.notes,
    latitude: o.latitude ?? null,
    longitude: o.longitude ?? null,
    createdAt: (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)).toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">ODP</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Daftar ODP yang terdaftar.</p>
        </div>
        <Link
          href="/admin/ftth/odp/new"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + Tambah ODP
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Nama</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Lokasi</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Koordinat</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Catatan</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Dibuat</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
            {odps.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data ODP.</td>
              </tr>
            ) : (
              odps.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{o.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{o.location || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{o.latitude != null && o.longitude != null ? (<span>{o.latitude.toFixed(6)}, {o.longitude.toFixed(6)}</span>) : ('-')}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{o.notes || '-'}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-500 dark:text-gray-400">{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2"><OdpActions id={o.id} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


