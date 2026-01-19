import Link from 'next/link'
import SiteFilterRedirect from '@/components/common/SiteFilterRedirect'
import { getJoinboxRepository } from '@/lib/repositories'
import ClosureTable from '@/components/closure/ClosureTable'

// Force dynamic rendering to avoid database queries during build
export const dynamic = 'force-dynamic'

type Joinbox = {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: string
}

export default async function ClosurePage({ searchParams }: { searchParams: { siteId?: string } }) {
  const repo = getJoinboxRepository()
  const rows = await repo.findAll(searchParams?.siteId)
  const items: Joinbox[] = rows.map((o: any) => ({
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">JOINbox / Closure</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Daftar JOINbox (bridge) yang terdaftar.</p>
        </div>
        <Link
          href="/admin/ftth/closure/new"
          className="inline-flex items-center justify-center w-full sm:w-auto gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + Tambah JOINbox
        </Link>
      </div>

      <div className="w-full sm:w-64">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Filter Site</label>
        <SiteFilterRedirect baseUrl="/admin/ftth/closure" className="w-full" />
      </div>

      <ClosureTable items={items} />
    </div>
  )
}


