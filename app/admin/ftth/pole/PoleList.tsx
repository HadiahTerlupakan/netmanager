import Link from 'next/link'
import SiteFilterRedirect from '@/components/common/SiteFilterRedirect'
import { getPoleRepository } from '@/lib/repositories'
import PoleTable from '@/components/pole/PoleTable'

// Force dynamic rendering to avoid database queries during build
export const dynamic = 'force-dynamic'

type Pole = {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  cableSlack: boolean
  createdAt: string
}

export default async function PolePage({ searchParams }: { searchParams: { siteId?: string } }) {
  const repo = getPoleRepository()
  const rows = await repo.findAll(searchParams?.siteId)
  const poles: Pole[] = rows.map((o: any) => ({
    id: o.id,
    name: o.name,
    location: o.location,
    notes: o.notes,
    latitude: o.latitude ?? null,
    longitude: o.longitude ?? null,
    status: o.status || 'AKTIF',
    cableSlack: o.cableSlack ?? false,
    createdAt: (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)).toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Pole / Tiang</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Daftar Pole/Tiang yang terdaftar.</p>
        </div>
        <Link
          href="/admin/ftth/pole/new"
          className="inline-flex items-center justify-center w-full sm:w-auto gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + Tambah Pole
        </Link>
      </div>

      <div className="w-full sm:w-64">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Filter Site</label>
        <SiteFilterRedirect baseUrl="/admin/ftth/pole" className="w-full" />
      </div>

      <PoleTable poles={poles} />
    </div>
  )
}


