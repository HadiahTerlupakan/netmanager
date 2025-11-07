import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import { ColorBadge } from '@/components/common/ColorBadge'
import { StatusBadge } from '@/components/common/StatusBadge'

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
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          }
        />
        <StatCard
          label="Total Output"
          value={detail.outputs.length}
          color="purple"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          }
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <InfoCard
            title="Informasi Dasar"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem
                label="Nama JOINbox"
                value={detail.name}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <path d="M9 9h6v6H9z"/>
                  </svg>
                }
              />
              <InfoItem
                label="Lokasi"
                value={detail.location}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                }
              />
              <InfoItem
                label="Koordinat"
                value={detail.latitude != null && detail.longitude != null ? `${detail.latitude.toFixed(6)}, ${detail.longitude.toFixed(6)}` : null}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                }
              />
              {detail.notes && (
                <InfoItem
                  label="Catatan"
                  value={detail.notes}
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                    </svg>
                  }
                />
              )}
            </div>
          </InfoCard>

          {/* INPUT */}
          <InfoCard
            title="INPUT"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            }
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
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            }
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
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            }
          >
            <MapPreview lat={detail.latitude} lon={detail.longitude} height={240} />
          </InfoCard>

          {/* Metadata */}
          <InfoCard
            title="Metadata"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            }
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


