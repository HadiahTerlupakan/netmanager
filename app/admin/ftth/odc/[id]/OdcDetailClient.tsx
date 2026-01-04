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
  HiOutlineClock,
  HiOutlineUser,
  HiOutlineMapPin,
  HiOutlineDocumentText
} from 'react-icons/hi2'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

export async function ClientComponent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const odc = await prisma.odc.findUnique({
    where: { id },
    include: {
      otbCore: { include: { otb: true } },
      odcOutput: { orderBy: { idx: 'asc' }, include: { odp: { select: { id: true, name: true } } } },
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
  const mappedOutputs = odc.odcOutput.filter(o => o.odp !== null).length

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
          value={odc.odcOutput.length}
          color="green"
          icon={<HiOutlineCube className="w-5 h-5" />}
        />
        <StatCard
          label="Output Terhubung"
          value={mappedOutputs}
          color="blue"
          icon={<HiCheck className="w-5 h-5" />}
        />
        <StatCard
          label="Output Tersedia"
          value={odc.odcOutput.length - mappedOutputs}
          color="gray"
          icon={<HiOutlineClock className="w-5 h-5" />}
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
                label="Nama ODC"
                value={odc.name}
                icon={<HiOutlineCube className="w-3 h-3" />}
              />
              <InfoItem
                label="Lokasi"
                value={odc.location}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              <InfoItem
                label="Koordinat"
                value={odc.latitude != null && odc.longitude != null ? `${odc.latitude.toFixed(6)}, ${odc.longitude.toFixed(6)}` : null}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              {odc.notes && (
                <InfoItem
                  label="Catatan"
                  value={odc.notes}
                  icon={<HiOutlineDocumentText className="w-3 h-3" />}
                />
              )}
            </div>
          </InfoCard>

          {/* INPUT - OTB Connection */}
          <InfoCard
            title="INPUT - Relasi Slot OTB"
            icon={<HiOutlineCube className="w-4 h-4" />}
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
          {odc.odcOutput.length > 0 && (
            <InfoCard
              title="OUTPUT - Output Cores"
              icon={<HiOutlineCube className="w-4 h-4" />}
            >
              <div className="overflow-hidden">
                <ResponsiveTable
                  data={odc.odcOutput}
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
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      priority: 'primary',
                      render: (item: any) => (
                        item.odp ? (
                          <Link href={`/admin/ftth/odp/${item.odp.id}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
                            <HiCheck className="w-3 h-3" />
                            Terhubung ke {item.odp.name}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 text-xs font-medium">
                            Tersedia
                          </span>
                        )
                      )
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
            <MapPreview lat={odc.latitude} lon={odc.longitude} height={240} />
          </InfoCard>

          {/* Metadata */}
          <InfoCard
            title="Metadata"
            icon={<HiOutlineClock className="w-4 h-4" />}
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


