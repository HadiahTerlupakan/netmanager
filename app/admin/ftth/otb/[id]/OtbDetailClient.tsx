import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import Image from 'next/image'
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
import { OtbCoreTable } from './OtbCoreTable'

export async function ClientComponent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const otb = await prisma.otb.findUnique({
    where: { id },
    include: { otbCore: { orderBy: { idx: 'asc' }, include: { odc: { select: { id: true, name: true } } } } },
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

  const mappedCores = otb.otbCore.filter(c => c.odc !== null).length
  const standard12Colors = ['Biru', 'Oranye', 'Hijau', 'Coklat', 'Slate', 'Putih', 'Merah', 'Hitam', 'Kuning', 'Ungu', 'Rose', 'Aqua']

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
          icon={<HiOutlineCube className="w-5 h-5" />}
        />
        <StatCard
          label="Core Terpetakan"
          value={mappedCores}
          color="green"
          icon={<HiCheck className="w-5 h-5" />}
        />
        <StatCard
          label="Core Tersedia"
          value={otb.coreCount - mappedCores}
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
                label="Nama OTB"
                value={otb.name}
                icon={<HiOutlineCube className="w-3 h-3" />}
              />
              <InfoItem
                label="Lokasi"
                value={otb.location}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              <InfoItem
                label="Koordinat"
                value={otb.latitude != null && otb.longitude != null ? `${otb.latitude.toFixed(6)}, ${otb.longitude.toFixed(6)}` : null}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              <InfoItem
                label="Jumlah Core"
                value={otb.coreCount}
                icon={<HiOutlineCube className="w-3 h-3" />}
              />
              {otb.notes && (
                <InfoItem
                  label="Catatan"
                  value={otb.notes}
                  icon={<HiOutlineDocumentText className="w-3 h-3" />}
                />
              )}
            </div>
          </InfoCard>

          {/* Core Mapping Table */}
          <InfoCard
            title="Mapping Core"
            icon={<HiOutlineCube className="w-4 h-4" />}
          >
            {otb.images && otb.images.length > 0 && (
              <div className="mb-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                 <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Foto Fisik</p>
                 <div className="grid grid-cols-2 gap-2">
                   {otb.images.map((img, idx) => (
                     <div key={idx} className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <Image
                          src={img}
                          alt={`${otb.name} - ${idx + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                     </div>
                   ))}
                 </div>
              </div>
            )}
            <div className="overflow-hidden">
              <OtbCoreTable data={otb.otbCore || []} />
            </div>
          </InfoCard>
        </div>

        {/* Right Column - Location & Metadata */}
        <div className="space-y-6">
          {/* Location Map */}
          <InfoCard
            title="Lokasi"
            icon={
              <HiOutlineMapPin className="w-4 h-4" />
            }
          >
            <MapPreview lat={otb.latitude} lon={otb.longitude} height={240} />
          </InfoCard>

          {/* Metadata */}
          <InfoCard
            title="Metadata"
            icon={
              <HiOutlineClock className="w-4 h-4" />
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


