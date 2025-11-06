import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function OdpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const odp = await prisma.odp.findUnique({
    where: { id },
    include: {
      odcOutput: { include: { odc: true } },
      outputs: { orderBy: { idx: 'asc' } },
    },
  })
  if (!odp) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Detail ODP</h1>
          <Link href="/admin/ftth/odp" className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Kembali</Link>
        </div>
        <div className="text-sm text-gray-500">ODP tidak ditemukan.</div>
      </div>
    )
  }

  const output = odp.odcOutput
  const odc = output?.odc

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Detail ODP</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Informasi ODP dan relasi ke output ODC.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ftth/odp" className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Kembali</Link>
          <Link href={`/admin/ftth/odp/${odp.id}/edit`} className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Edit</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="text-sm"><span className="text-gray-500">Nama:</span> {odp.name}</div>
        <div className="text-sm"><span className="text-gray-500">Lokasi:</span> {odp.location || '-'}</div>
        <div className="text-sm"><span className="text-gray-500">Koordinat:</span> {odp.latitude != null && odp.longitude != null ? `${odp.latitude.toFixed(6)}, ${odp.longitude.toFixed(6)}` : '-'}</div>
        <div className="text-sm col-span-full"><span className="text-gray-500">Catatan:</span> {odp.notes || '-'}</div>
      </div>

      <div className="rounded-md border border-gray-200 dark:border-gray-800">
        <div className="px-3 py-2 text-xs font-semibold bg-gray-50 dark:bg-gray-900">INPUT - Relasi Output ODC</div>
        <div className="p-3 text-sm space-y-1">
          <div><span className="text-gray-500">ODC:</span> {odc ? odc.name : '-'}</div>
          <div><span className="text-gray-500">Nama Slot:</span> {output ? output.slotName : '-'}</div>
          <div><span className="text-gray-500">Idx:</span> {output ? output.idx + 1 : '-'}</div>
          <div><span className="text-gray-500">Tube/Core Color:</span> {output ? `${output.tubeColor || 'Non-tube'} / ${output.coreColor || '-'}` : '-'}</div>
          <div><span className="text-gray-500">Redaman:</span> {output ? (output.redaman != null ? `${output.redaman.toFixed(2)} dB` : '-') : '-'}</div>
        </div>
      </div>

      {(odp.outputs && odp.outputs.length > 0) && (
        <div className="rounded-md border border-gray-200 dark:border-gray-800">
          <div className="px-3 py-2 text-xs font-semibold bg-gray-50 dark:bg-gray-900">OUTPUT - Output Cores</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium">Idx</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Nama Slot</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Redaman</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Tube Color</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Core Color</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
                {odp.outputs.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2 text-sm">{o.idx + 1}</td>
                    <td className="px-3 py-2 text-sm">{o.slotName}</td>
                    <td className="px-3 py-2 text-sm">{o.redaman != null ? `${o.redaman.toFixed(2)} dB` : '-'}</td>
                    <td className="px-3 py-2 text-sm">{o.tubeColor || 'Non-tube'}</td>
                    <td className="px-3 py-2 text-sm">{o.coreColor || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


