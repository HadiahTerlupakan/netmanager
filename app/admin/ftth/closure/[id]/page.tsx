import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import { ColorBadge } from '@/components/common/ColorBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { 
  HiOutlineCube, 
  HiOutlineUser, 
  HiOutlineMapPin, 
  HiOutlineDocumentText,
  HiOutlineClock
} from 'react-icons/hi2'

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
          <Link href="/admin/ftth/closure" className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Kembali</Link>
        </div>
        <div className="text-sm text-red-600 dark:text-red-400">Data tidak ditemukan.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{detail.name}</h1>
            <StatusBadge status={detail.status} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Informasi lengkap JOINbox / Closure</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ftth/closure" className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Kembali
          </Link>
          <Link href={`/admin/ftth/closure/${detail.id}/edit`} className="text-sm px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Total Input"
          value={detail.inputs.length}
          color="purple"
          icon={<HiOutlineCube className="w-5 h-5" />}
        />
        <StatCard
          label="Total Output"
          value={detail.outputs.length}
          color="purple"
          icon={<HiOutlineCube className="w-5 h-5" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <InfoCard
            title="Informasi Dasar"
            icon={<HiOutlineUser className="w-4 h-4" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem
                label="Nama JOINbox"
                value={detail.name}
                icon={<HiOutlineCube className="w-3 h-3" />}
              />
              <InfoItem
                label="Lokasi"
                value={detail.location}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              <InfoItem
                label="Koordinat"
                value={detail.latitude != null && detail.longitude != null ? `${detail.latitude.toFixed(6)}, ${detail.longitude.toFixed(6)}` : null}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              {detail.notes && (
                <InfoItem
                  label="Catatan"
                  value={detail.notes}
                  icon={<HiOutlineDocumentText className="w-3 h-3" />}
                />
              )}
            </div>
          </InfoCard>

          {/* INPUT */}
          <InfoCard
            title="INPUT"
            icon={<HiOutlineCube className="w-4 h-4" />}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Input Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Port Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tube Color</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Core Color</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
                  {detail.inputs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Tidak ada data input.
                      </td>
                    </tr>
                  ) : (
                    detail.inputs.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {r.idx + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {r.inputUnit}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {r.portUnit}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <ColorBadge color={r.tubeColor || 'Non-tube'} />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <ColorBadge color={r.coreColor || '-'} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </InfoCard>

          {/* OUTPUT */}
          <InfoCard
            title="OUTPUT"
            icon={<HiOutlineCube className="w-4 h-4" />}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Input Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Port Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tube Color</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Core Color</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
                  {detail.outputs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Tidak ada data output.
                      </td>
                    </tr>
                  ) : (
                    detail.outputs.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {r.idx + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {r.inputUnit}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {r.portUnit}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <ColorBadge color={r.tubeColor || 'Non-tube'} />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <ColorBadge color={r.coreColor || '-'} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </InfoCard>
        </div>

        {/* Right Column - Location & Metadata */}
        <div className="space-y-6">
          {/* Location Map */}
          <InfoCard
            title="Lokasi"
            icon={<HiOutlineMapPin className="w-4 h-4" />}
          >
            <MapPreview lat={detail.latitude} lon={detail.longitude} height={240} />
          </InfoCard>

          {/* Metadata */}
          <InfoCard
            title="Metadata"
            icon={<HiOutlineClock className="w-4 h-4" />}
          >
            <div className="space-y-3">
              <InfoItem
                label="Dibuat"
                value={new Date(detail.createdAt).toLocaleString('id-ID', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              />
              <InfoItem
                label="Diperbarui"
                value={new Date(detail.updatedAt).toLocaleString('id-ID', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              />
            </div>
          </InfoCard>
        </div>
      </div>
    </div>
  )
}


