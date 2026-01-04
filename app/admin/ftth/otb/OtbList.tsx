import Link from 'next/link'
import { getOtbRepository } from '@/lib/repositories'
import OtbTable from '@/components/otb/OtbTable'

// Force dynamic rendering to avoid database queries during build
export const dynamic = 'force-dynamic'

type Otb = {
  id: string
  name: string
  location: string | null
  coreCount: number
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: string
}

export default async function OTBPage() {
  const repo = getOtbRepository()
  const rows = await repo.findAll()
  const otbs: Otb[] = rows.map((o: any) => ({
    id: o.id,
    name: o.name,
    location: o.location,
    coreCount: o.coreCount,
    notes: o.notes,
    latitude: o.latitude ?? null,
    longitude: o.longitude ?? null,
    status: o.status || 'AKTIF',
    createdAt: (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)).toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">OTB</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Daftar OTB yang terdaftar.</p>
        </div>
        <Link
          href="/admin/ftth/otb/new"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + Tambah OTB
        </Link>
      </div>

      <OtbTable otbs={otbs} />
    </div>
  )
}


