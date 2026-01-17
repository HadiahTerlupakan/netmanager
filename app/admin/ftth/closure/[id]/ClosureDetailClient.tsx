import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import { StatusBadge } from '@/components/common/StatusBadge'
import {
  HiOutlineCube,
  HiOutlineUser,
  HiOutlineMapPin,
  HiOutlineDocumentText,
  HiOutlineClock
} from 'react-icons/hi2'
import ClosureDetailTable from '@/components/closure/ClosureDetailTable'

export async function ClientComponent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await prisma.joinbox.findUnique({
    where: { id },
    include: { joinboxInput: { orderBy: { idx: 'asc' } }, joinboxOutput: { orderBy: { idx: 'asc' } } },
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
          value={detail.joinboxInput.length}
          color="purple"
          icon={<HiOutlineCube className="w-5 h-5" />}
        />
        <StatCard
          label="Total Output"
          value={detail.joinboxOutput.length}
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

          {detail.images && detail.images.length > 0 && (
            <InfoCard title="Foto Fisik" icon={<HiOutlineCube className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-2">
                {detail.images.map((img, idx) => (
                  <div key={idx} className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <Image
                      src={img}
                      alt={`${detail.name} - ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  </div>
                ))}
              </div>
            </InfoCard>
          )}

          {/* INPUT */}
          <InfoCard
            title="INPUT"
            icon={<HiOutlineCube className="w-4 h-4" />}
          >
            <ClosureDetailTable data={detail.joinboxInput} type="Input" />
          </InfoCard>

          {/* OUTPUT */}
          <InfoCard
            title="OUTPUT"
            icon={<HiOutlineCube className="w-4 h-4" />}
          >
            <ClosureDetailTable data={detail.joinboxOutput} type="Output" />
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


