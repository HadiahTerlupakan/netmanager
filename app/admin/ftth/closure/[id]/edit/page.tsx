import Link from 'next/link'
import { JoinboxForm } from '@/components/closure/JoinboxForm'
import { prisma } from '@/lib/prisma'

export default async function EditJoinboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await prisma.joinbox.findUnique({
    where: { id },
    include: { inputs: { orderBy: { idx: 'asc' } }, outputs: { orderBy: { idx: 'asc' } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Edit JOINbox</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Perbarui data JOINbox/closure.</p>
        </div>
        <Link href="/admin/ftth/closure" className="text-sm text-gray-600 dark:text-gray-400">Kembali</Link>
      </div>

      <JoinboxForm mode="edit" initial={{
        id,
        name: detail?.name,
        location: detail?.location,
        notes: detail?.notes,
        latitude: detail?.latitude ?? null,
        longitude: detail?.longitude ?? null,
        inputs: (detail?.inputs || []).map((x: any, i: number) => ({ idx: i, inputUnit: x.inputUnit, portUnit: x.portUnit, tubeColor: x.tubeColor, coreColor: x.coreColor })),
        outputs: (detail?.outputs || []).map((x: any, i: number) => ({ idx: i, inputUnit: x.inputUnit, portUnit: x.portUnit, tubeColor: x.tubeColor, coreColor: x.coreColor })),
      }} />
    </div>
  )
}


