import Link from 'next/link'
import { getPoleRepository } from '@/lib/repositories'
import { PoleActions } from '@/components/pole/PoleActions'

type Pole = {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  cableSlack: boolean
  createdAt: string
}

export default async function PolePage() {
  const repo = getPoleRepository()
  const rows = await repo.findAll()
  const poles: Pole[] = rows.map((o: any) => ({
    id: o.id,
    name: o.name,
    location: o.location,
    notes: o.notes,
    latitude: o.latitude ?? null,
    longitude: o.longitude ?? null,
    cableSlack: o.cableSlack ?? false,
    createdAt: (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)).toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Pole / Tiang</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Daftar Pole/Tiang yang terdaftar.</p>
        </div>
        <Link
          href="/admin/ftth/pole/new"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + Tambah Pole
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Nama</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Lokasi</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Koordinat</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Cable Slack</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Catatan</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Dibuat</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
            {poles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data Pole.</td>
              </tr>
            ) : (
              poles.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{o.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{o.location || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {o.latitude != null && o.longitude != null ? (
                      <span className="font-mono text-xs">{o.latitude.toFixed(6)}, {o.longitude.toFixed(6)}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      o.cableSlack 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {o.cableSlack ? 'Ada' : 'Tidak'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate" title={o.notes || undefined}>{o.notes || '-'}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{new Date(o.createdAt).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-right"><PoleActions id={o.id} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


