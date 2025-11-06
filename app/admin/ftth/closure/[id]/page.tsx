import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function JoinboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await prisma.joinbox.findUnique({
    where: { id },
    include: { inputs: { orderBy: { idx: 'asc' } }, outputs: { orderBy: { idx: 'asc' } } },
  })

  if (!detail) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">JOINbox</h1>
          <Link href="/admin/ftth/closure" className="text-sm text-gray-600 dark:text-gray-400">Kembali</Link>
        </div>
        <div className="text-sm text-red-600 dark:text-red-400">Data tidak ditemukan.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Detail JOINbox</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{detail.name}</p>
        </div>
        <Link href="/admin/ftth/closure" className="text-sm text-gray-600 dark:text-gray-400">Kembali</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Nama</div>
          <div className="text-sm">{detail.name}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Lokasi</div>
          <div className="text-sm">{detail.location || '-'}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Koordinat</div>
          <div className="text-sm">{detail.latitude != null && detail.longitude != null ? `${detail.latitude.toFixed(6)}, ${detail.longitude.toFixed(6)}` : '-'}</div>
        </div>
        <div className="space-y-1 md:col-span-2">
          <div className="text-xs text-gray-500">Catatan</div>
          <div className="text-sm">{detail.notes || '-'}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-md font-semibold text-gray-900 dark:text-white">INPUT</h2>
        <div className="rounded-md border border-gray-200 dark:border-gray-800 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs">INPUT UNIT</th>
                <th className="px-3 py-2 text-left text-xs">PORT UNIT</th>
                <th className="px-3 py-2 text-left text-xs">Tube Color</th>
                <th className="px-3 py-2 text-left text-xs">Core Color</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
              {(detail.inputs || []).length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">Tidak ada data.</td></tr>
              ) : (
                detail.inputs.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-sm">{r.inputUnit}</td>
                    <td className="px-3 py-2 text-sm">{r.portUnit}</td>
                    <td className="px-3 py-2 text-sm">{r.tubeColor}</td>
                    <td className="px-3 py-2 text-sm">{r.coreColor}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-md font-semibold text-gray-900 dark:text-white">OUTPUT</h2>
        <div className="rounded-md border border-gray-200 dark:border-gray-800 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs">INPUT UNIT</th>
                <th className="px-3 py-2 text-left text-xs">PORT UNIT</th>
                <th className="px-3 py-2 text-left text-xs">Tube Color</th>
                <th className="px-3 py-2 text-left text-xs">Core Color</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
              {(detail.outputs || []).length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">Tidak ada data.</td></tr>
              ) : (
                detail.outputs.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-sm">{r.inputUnit}</td>
                    <td className="px-3 py-2 text-sm">{r.portUnit}</td>
                    <td className="px-3 py-2 text-sm">{r.tubeColor}</td>
                    <td className="px-3 py-2 text-sm">{r.coreColor}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


