import Link from 'next/link'
import { getOdpRepository } from '@/lib/repositories'
import OdpTable from '@/components/odp/OdpTable'
import SiteFilterRedirect from '@/components/common/SiteFilterRedirect'

// Force dynamic rendering to avoid database queries during build
export const dynamic = 'force-dynamic'

type Odp = {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  outputCount: number
  siteName: string
  createdAt: string
}

export default async function ODPPage({ searchParams }: { searchParams: { siteId?: string } }) {
  const repo = getOdpRepository()
  const rows = await repo.findAll(searchParams?.siteId)
  const odps: Odp[] = rows.map((o: any) => ({
    id: o.id,
    name: o.name,
    location: o.location,
    notes: o.notes,
    latitude: o.latitude ?? null,
    longitude: o.longitude ?? null,
    status: o.status || 'AKTIF',
    outputCount: o._count?.odpOutput || 0,
    siteName: o.site?.name || '-',
    createdAt: (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)).toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">ODP</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Daftar ODP yang terdaftar.</p>
        </div>
        <Link
          href="/admin/ftth/odp/new"
          className="inline-flex items-center justify-center w-full sm:w-auto gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + Tambah ODP
        </Link>
      </div>

      <div className="w-full sm:w-64">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Filter Site</label>
        <SiteFilterRedirect baseUrl="/admin/ftth/odp" className="w-full" />
      </div>

      <OdpTable odps={odps} />
    </div>
  )
}


