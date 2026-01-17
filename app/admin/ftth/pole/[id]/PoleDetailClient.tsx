import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import Image from 'next/image'
import { StatusBadge } from '@/components/common/StatusBadge'
import { 
  HiOutlineCube, 
  HiOutlineMapPin, 
  HiOutlineUser, 
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineBuildingOffice,
  HiCheck,
  HiXCircle
} from 'react-icons/hi2'

export async function ClientComponent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pole = await prisma.pole.findUnique({
    where: { id },
  })

  if (!pole) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Detail Pole / Tiang</h1>
          <Link href="/admin/ftth/pole" className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Kembali</Link>
        </div>
        <div className="text-sm text-gray-500">Pole tidak ditemukan.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{pole.name}</h1>
            <StatusBadge status={pole.status} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Informasi lengkap Pole / Tiang</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ftth/pole" className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Kembali
          </Link>
          <Link href={`/admin/ftth/pole/${pole.id}/edit`} className="text-sm px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Status Cable Slack"
          value={pole.cableSlack ? 'Ya' : 'Tidak'}
          color={pole.cableSlack ? 'orange' : 'gray'}
          icon={<HiOutlineCube className="w-5 h-5" />}
        />
        <StatCard
          label="Koordinat"
          value={pole.latitude != null && pole.longitude != null ? 'Tersedia' : 'Tidak Tersedia'}
          color={pole.latitude != null && pole.longitude != null ? 'green' : 'gray'}
          icon={<HiOutlineMapPin className="w-5 h-5" />}
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
                label="Nama Pole"
                value={pole.name}
                icon={<HiOutlineBuildingOffice className="w-3 h-3" />}
              />
              <InfoItem
                label="Lokasi"
                value={pole.location}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              <InfoItem
                label="Koordinat"
                value={pole.latitude != null && pole.longitude != null ? `${pole.latitude.toFixed(6)}, ${pole.longitude.toFixed(6)}` : null}
                icon={<HiOutlineMapPin className="w-3 h-3" />}
              />
              <InfoItem
                label="Cable Slack"
                value={
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                    pole.cableSlack 
                      ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' 
                      : 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400'
                  }`}>
                    {pole.cableSlack ? (
                      <>
                        <HiCheck className="w-3 h-3" />
                        Ya
                      </>
                    ) : (
                      <>
                        <HiXCircle className="w-3 h-3" />
                        Tidak
                      </>
                    )}
                  </span>
                }
                icon={<HiOutlineCube className="w-3 h-3" />}
              />
              {pole.notes && (
                <InfoItem
                  label="Catatan"
                  value={pole.notes}
                  icon={<HiOutlineDocumentText className="w-3 h-3" />}
                />
              )}
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
            <MapPreview lat={pole.latitude} lon={pole.longitude} height={240} />
          </InfoCard>

          {pole.images && pole.images.length > 0 && (
            <InfoCard title="Foto Fisik" icon={<HiOutlineCube className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-2">
                {pole.images.map((img, idx) => (
                  <div key={idx} className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <Image
                      src={img}
                      alt={`${pole.name} - ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  </div>
                ))}
              </div>
            </InfoCard>
          )}

          {/* Metadata */}
          <InfoCard
            title="Metadata"
            icon={<HiOutlineClock className="w-4 h-4" />}
          >
            <div className="space-y-3">
              <InfoItem
                label="Dibuat"
                value={new Date(pole.createdAt).toLocaleString('id-ID', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              />
              <InfoItem
                label="Diperbarui"
                value={new Date(pole.updatedAt).toLocaleString('id-ID', {
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

