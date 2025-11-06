import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function OtbDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const otb = await prisma.otb.findUnique({
    where: { id },
    include: { cores: { orderBy: { idx: 'asc' } } },
  })
  if (!otb) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Detail OTB</h1>
          <Link href="/admin/ftth/otb" className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Kembali</Link>
        </div>
        <div className="text-sm text-gray-500">OTB tidak ditemukan.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Detail OTB</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Informasi lengkap OTB beserta mapping core.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ftth/otb" className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Kembali</Link>
          <Link href={`/admin/ftth/otb/${otb.id}/edit`} className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Edit</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="text-sm"><span className="text-gray-500">Nama:</span> {otb.name}</div>
        <div className="text-sm"><span className="text-gray-500">Lokasi:</span> {otb.location || '-'}</div>
        <div className="text-sm"><span className="text-gray-500">Jumlah Core:</span> {otb.coreCount}</div>
        <div className="text-sm"><span className="text-gray-500">Koordinat:</span> {otb.latitude != null && otb.longitude != null ? `${otb.latitude.toFixed(6)}, ${otb.longitude.toFixed(6)}` : '-'}</div>
        <div className="text-sm col-span-full"><span className="text-gray-500">Catatan:</span> {otb.notes || '-'}</div>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium">Idx</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Nama Slot</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Tube Color</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Core Color</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
            {(otb.cores || []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">Belum ada mapping core.</td>
              </tr>
            ) : (
              otb.cores.map((c) => {
                const standard12Colors = ['Biru','Oranye','Hijau','Coklat','Slate','Putih','Merah','Hitam','Kuning','Ungu','Rose','Aqua']
                const tubeColor = c.tubeColor && c.tubeColor.trim() !== '' ? c.tubeColor : 'Non-tube'
                const coreColor = c.coreColor && c.coreColor.trim() !== '' ? c.coreColor : standard12Colors[c.idx % 12]
                return (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-sm">{c.idx + 1}</td>
                  <td className="px-3 py-2 text-sm">{c.slotName}</td>
                  <td className="px-3 py-2 text-sm">{tubeColor}</td>
                  <td className="px-3 py-2 text-sm">{coreColor}</td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


