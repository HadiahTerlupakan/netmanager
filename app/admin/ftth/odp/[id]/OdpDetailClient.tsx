import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import { ColorBadge } from '@/components/common/ColorBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import {
  HiOutlineCube,
  HiCheck,
  HiXCircle,
  HiOutlineUser,
  HiOutlineMapPin,
  HiOutlineDocumentText,
  HiOutlineClock
} from 'react-icons/hi2'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

export async function ClientComponent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const odp = await prisma.odp.findUnique({
    where: { id },
    include: {
      odcOutput: {
        include: {
          odc: {
            include: {
              otbCore: {
                include: {
                  otb: { select: { id: true, name: true } }
                }
              }
            }
          }
        }
      },
      odpOutput: { orderBy: { idx: 'asc' } },
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
  const otbCore = odc?.otbCore
  const otb = otbCore?.otb

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{odp.name}</h1>
            <StatusBadge status={odp.status} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Informasi ODP dan relasi ke output ODC</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ftth/odp" className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Kembali
          </Link>
          <Link href={`/admin/ftth/odp/${odp.id}/edit`} className="text-sm px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Total Output"
          value={odp.odpOutput.length}
          color="orange"
          icon={<HiOutlineCube className="w-5 h-5" />}
        />
        <StatCard
          label="Status Input"
          value={output ? 'Terhubung' : 'Tidak Terhubung'}
          color={output ? 'green' : 'gray'}
          icon={output ? <HiCheck className="w-5 h-5" /> : <HiXCircle className="w-5 h-5" />}
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
                label="Nama ODP"
                value={odp.name}
                icon={<HiOutlineCube className="w-3 h-3" />}
              />
              <InfoItem
                label="Lokasi"
                value={odp.location}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              <InfoItem
                label="Koordinat"
                value={odp.latitude != null && odp.longitude != null ? `${odp.latitude.toFixed(6)}, ${odp.longitude.toFixed(6)}` : null}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              {odp.notes && (
                <InfoItem
                  label="Catatan"
                  value={odp.notes}
                  icon={<HiOutlineDocumentText className="w-3 h-3" />}
                />
              )}
            </div>
          </InfoCard>

          {/* INPUT - ODC Connection */}
          <InfoCard
            title="INPUT - Relasi Output ODC"
            icon={<HiOutlineCube className="w-4 h-4" />}
          >
            {output && odc ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Terhubung ke ODC</span>
                    <Link
                      href={`/admin/ftth/odc/${odc.id}`}
                      className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      Lihat Detail
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoItem
                      label="ODC"
                      value={
                        <Link href={`/admin/ftth/odc/${odc.id}`} className="text-green-700 dark:text-green-400 hover:underline font-medium">
                          {odc.name}
                        </Link>
                      }
                    />
                    <InfoItem
                      label="Nama Slot"
                      value={output.slotName}
                    />
                    <InfoItem
                      label="Index"
                      value={output.idx + 1}
                    />
                    <InfoItem
                      label="Redaman"
                      value={output.redaman != null ? `${output.redaman.toFixed(2)} dB` : '-'}
                    />
                    <InfoItem
                      label="Tube Color"
                      value={<ColorBadge color={output.tubeColor || 'Non-tube'} />}
                    />
                    <InfoItem
                      label="Core Color"
                      value={<ColorBadge color={output.coreColor || '-'} />}
                    />
                  </div>
                </div>

                {/* Chain to OTB */}
                {otbCore && otb && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Chain ke OTB</span>
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
                        label="Slot OTB"
                        value={otbCore.slotName}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Tidak ada relasi ke ODC
              </div>
            )}
          </InfoCard>

          {/* OUTPUT - Output Cores */}
          {odp.odpOutput.length > 0 && (
            <InfoCard
              title="OUTPUT - Output Cores"
              icon={<HiOutlineCube className="w-4 h-4" />}
            >
              <div className="overflow-hidden">
                <ResponsiveTable
                  data={odp.odpOutput}
                  keyField="id"
                  columns={[
                    {
                      key: 'idx',
                      header: 'No',
                      priority: 'primary',
                      render: (item: any) => <span className="text-sm font-medium text-gray-900 dark:text-white">{item.idx + 1}</span>
                    },
                    {
                      key: 'slotName',
                      header: 'Nama Slot',
                      priority: 'primary',
                      render: (item: any) => <span className="text-sm text-gray-900 dark:text-white">{item.slotName}</span>
                    },
                    {
                      key: 'redaman',
                      header: 'Redaman',
                      priority: 'secondary',
                      render: (item: any) => (
                        item.redaman != null ? (
                          <span className="font-medium text-gray-900 dark:text-white">{item.redaman.toFixed(2)} dB</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )
                      )
                    },
                    {
                      key: 'tubeColor',
                      header: 'Tube Color',
                      priority: 'secondary',
                      render: (item: any) => <ColorBadge color={item.tubeColor || 'Non-tube'} />
                    },
                    {
                      key: 'coreColor',
                      header: 'Core Color',
                      priority: 'secondary',
                      render: (item: any) => <ColorBadge color={item.coreColor || '-'} />
                    }
                  ]}
                />
              </div>
            </InfoCard>
          )}
        </div>

        {/* Right Column - Location & Metadata */}
        <div className="space-y-6">
          {/* Location Map */}
          <InfoCard
            title="Lokasi"
            icon={<HiOutlineMapPin className="w-4 h-4" />}
          >
            <MapPreview lat={odp.latitude} lon={odp.longitude} height={240} />
          </InfoCard>

          {/* Metadata */}
          <InfoCard
            title="Metadata"
            icon={<HiOutlineClock className="w-4 h-4" />}
          >
            <div className="space-y-3">
              <InfoItem
                label="Dibuat"
                value={new Date(odp.createdAt).toLocaleString('id-ID', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              />
              <InfoItem
                label="Diperbarui"
                value={new Date(odp.updatedAt).toLocaleString('id-ID', {
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


