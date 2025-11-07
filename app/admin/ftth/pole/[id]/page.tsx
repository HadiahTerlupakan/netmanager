import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import { StatusBadge } from '@/components/common/StatusBadge'

export default async function PoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              {pole.cableSlack ? (
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              ) : (
                <path d="M12 2L2 7l10 5 10-5-10-5z" strokeDasharray="2 2"/>
              )}
            </svg>
          }
        />
        <StatCard
          label="Koordinat"
          value={pole.latitude != null && pole.longitude != null ? 'Tersedia' : 'Tidak Tersedia'}
          color={pole.latitude != null && pole.longitude != null ? 'green' : 'gray'}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
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
                label="Nama Pole"
                value={pole.name}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M12 2v20M2 12h20"/>
                  </svg>
                }
              />
              <InfoItem
                label="Lokasi"
                value={pole.location}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                }
              />
              <InfoItem
                label="Koordinat"
                value={pole.latitude != null && pole.longitude != null ? `${pole.latitude.toFixed(6)}, ${pole.longitude.toFixed(6)}` : null}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                }
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Ya
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                          <circle cx="12" cy="12" r="10"/>
                        </svg>
                        Tidak
                      </>
                    )}
                  </span>
                }
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  </svg>
                }
              />
              {pole.notes && (
                <InfoItem
                  label="Catatan"
                  value={pole.notes}
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
            <MapPreview lat={pole.latitude} lon={pole.longitude} height={240} />
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

