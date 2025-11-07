import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import { ColorBadge } from '@/components/common/ColorBadge'
import { StatusBadge } from '@/components/common/StatusBadge'

export default async function OtbDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const otb = await prisma.otb.findUnique({
    where: { id },
    include: { cores: { orderBy: { idx: 'asc' }, include: { odc: { select: { id: true, name: true } } } } },
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

  const mappedCores = otb.cores.filter(c => c.odc !== null).length
  const standard12Colors = ['Biru','Oranye','Hijau','Coklat','Slate','Putih','Merah','Hitam','Kuning','Ungu','Rose','Aqua']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{otb.name}</h1>
            <StatusBadge status={otb.status} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Informasi lengkap OTB beserta mapping core</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ftth/otb" className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Kembali
          </Link>
          <Link href={`/admin/ftth/otb/${otb.id}/edit`} className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Core"
          value={otb.coreCount}
          color="blue"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          }
        />
        <StatCard
          label="Core Terpetakan"
          value={mappedCores}
          color="green"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          }
        />
        <StatCard
          label="Core Tersedia"
          value={otb.coreCount - mappedCores}
          color="gray"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
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
                label="Nama OTB"
                value={otb.name}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                }
              />
              <InfoItem
                label="Lokasi"
                value={otb.location}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                }
              />
              <InfoItem
                label="Koordinat"
                value={otb.latitude != null && otb.longitude != null ? `${otb.latitude.toFixed(6)}, ${otb.longitude.toFixed(6)}` : null}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                }
              />
              <InfoItem
                label="Jumlah Core"
                value={otb.coreCount}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                }
              />
              {otb.notes && (
                <InfoItem
                  label="Catatan"
                  value={otb.notes}
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

          {/* Core Mapping Table */}
          <InfoCard
            title="Mapping Core"
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Nama Slot</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tube Color</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Core Color</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
                  {(otb.cores || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Belum ada mapping core.
                      </td>
                    </tr>
                  ) : (
                    otb.cores.map((c) => {
                      const tubeColor = c.tubeColor && c.tubeColor.trim() !== '' ? c.tubeColor : 'Non-tube'
                      const coreColor = c.coreColor && c.coreColor.trim() !== '' ? c.coreColor : standard12Colors[c.idx % 12]
                      const isMapped = c.odc !== null
                      return (
                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {c.idx + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {c.slotName}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <ColorBadge color={tubeColor} />
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <ColorBadge color={coreColor} />
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isMapped ? (
                              <Link href={`/admin/ftth/odc/${c.odc!.id}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                                  <path d="M20 6L9 17l-5-5"/>
                                </svg>
                                Terhubung ke {c.odc!.name}
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 text-xs font-medium">
                                Tersedia
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
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
            <MapPreview lat={otb.latitude} lon={otb.longitude} height={240} />
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
                value={new Date(otb.createdAt).toLocaleString('id-ID', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              />
              <InfoItem
                label="Diperbarui"
                value={new Date(otb.updatedAt).toLocaleString('id-ID', {
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


