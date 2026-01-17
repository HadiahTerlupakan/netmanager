import { getPoleRepository } from '@/lib/repositories'
import { PoleForm } from '@/components/pole/PoleForm'

export async function ClientComponent(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const repo = getPoleRepository()
  const o = await repo.findById(id)
  if (!o) {
    return (
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Pole tidak ditemukan</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Data dengan ID tersebut tidak tersedia.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Pole / Tiang</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Perbarui data pole/tiang.</p>
      </div>
      <PoleForm
        mode="edit"
        initial={{
          id: o.id,
          name: o.name,
          images: o.images,
          location: o.location,
          notes: o.notes,
          latitude: o.latitude,
          longitude: o.longitude,
          status: o.status as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' | undefined,
          cableSlack: (o as any).cableSlack ?? false,
        }}
      />
    </div>
  )
}


