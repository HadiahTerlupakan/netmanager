import Link from 'next/link'
import { getOdcRepository } from '@/lib/repositories'
import OdcTable from '@/components/odc/OdcTable'

// Force dynamic rendering to avoid database queries during build
export const dynamic = 'force-dynamic'

type Odc = {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: string
}

export default async function ODCPage() {
  const repo = getOdcRepository()
  const rows = await repo.findAll()
  const odcs: Odc[] = rows.map((o: any) => ({
    id: o.id,
    name: o.name,
    location: o.location,
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
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">ODC</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Daftar ODC yang terdaftar.</p>
        </div>
        <Link
          href="/admin/ftth/odc/new"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + Tambah ODC
        </Link>
      </div>

      <OdcTable odcs={odcs} />
    </div>
  )
}


