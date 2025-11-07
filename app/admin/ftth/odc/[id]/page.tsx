import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import { ColorBadge } from '@/components/common/ColorBadge'
import { StatusBadge } from '@/components/common/StatusBadge'

export default async function OdcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const odc = await prisma.odc.findUnique({
    where: { id },
    include: {
      otbCore: { include: { otb: true } },
      outputs: { orderBy: { idx: 'asc' }, include: { odp: { select: { id: true, name: true } } } },
    },
  })
  if (!odc) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Detail ODC</h1>
          <Link href="/admin/ftth/odc" className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Kembali</Link>
        </div>
        <div className="text-sm text-gray-500">ODC tidak ditemukan.</div>
      </div>
    )
  }

  const slot = odc.otbCore
  const otb = slot?.otb
  const mappedOutputs = odc.outputs.filter(o => o.odp !== null).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{odc.name}</h1>
            <StatusBadge status={odc.status} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Informasi ODC dan relasi ke slot OTB</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ftth/odc" className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Kembali
          </Link>
          <Link href={`/admin/ftth/odc/${odc.id}/edit`} className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Output"
          value={odc.outputs.length}
          color="green"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          }
        />
        <StatCard
          label="Output Terhubung"
          value={mappedOutputs}
          color="blue"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          }
        />
        <StatCard
          label="Output Tersedia"
          value={odc.outputs.length - mappedOutputs}
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
                label="Nama ODC"
                value={odc.name}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                }
              />
              <InfoItem
                label="Lokasi"
                value={odc.location}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                }
              />
              <InfoItem
                label="Koordinat"
                value={odc.latitude != null && odc.longitude != null ? `${odc.latitude.toFixed(6)}, ${odc.longitude.toFixed(6)}` : null}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                }
              />
              {odc.notes && (
                <InfoItem
                  label="Catatan"
                  value={odc.notes}
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

          {/* INPUT - OTB Connection */}
          <InfoCard
            title="INPUT - Relasi Slot OTB"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            }
          >
            {slot && otb ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Terhubung ke OTB</span>
                    <Link 
                      href={`/admin/ftth/otb/${otb.id}`}
                      className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Lihat Detail
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoItem
                      label="OTB"
                      value={
                        <Link href={`/admin/ftth/otb/${otb.id}`} className="text-blue-700 dark:text-blue-400 hover:underline font-medium">
                          {otb.name}
                        </Link>
                      }
                    />
                    <InfoItem
                      label="Nama Slot"
                      value={slot.slotName}
                    />
                    <InfoItem
                      label="Index"
                      value={slot.idx + 1}
                    />
                    <InfoItem
                      label="Tube Color"
                      value={<ColorBadge color={slot.tubeColor || 'Non-tube'} />}
                    />
                    <InfoItem
                      label="Core Color"
                      value={<ColorBadge color={slot.coreColor || '-'} />}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Tidak ada relasi ke OTB
              </div>
            )}
          </InfoCard>

          {/* OUTPUT - Output Cores */}
          {odc.outputs.length > 0 && (
            <InfoCard
              title="OUTPUT - Output Cores"
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Redaman</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tube Color</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Core Color</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
                    {odc.outputs.map((o) => {
                      const isMapped = o.odp !== null
                      return (
                        <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {o.idx + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {o.slotName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {o.redaman != null ? (
                              <span className="font-medium">{o.redaman.toFixed(2)} dB</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <ColorBadge color={o.tubeColor || 'Non-tube'} />
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <ColorBadge color={o.coreColor || '-'} />
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isMapped ? (
                              <Link href={`/admin/ftth/odp/${o.odp!.id}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                                  <path d="M20 6L9 17l-5-5"/>
                                </svg>
                                Terhubung ke {o.odp!.name}
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 text-xs font-medium">
                                Tersedia
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </InfoCard>
          )}
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
            <MapPreview lat={odc.latitude} lon={odc.longitude} height={240} />
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
                value={new Date(odc.createdAt).toLocaleString('id-ID', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              />
              <InfoItem
                label="Diperbarui"
                value={new Date(odc.updatedAt).toLocaleString('id-ID', {
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


