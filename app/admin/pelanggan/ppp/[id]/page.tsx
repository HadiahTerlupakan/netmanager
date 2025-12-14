import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { StatCard } from '@/components/common/StatCard'
import { InfoCard, InfoItem } from '@/components/common/InfoCard'
import MapPreview from '@/components/common/MapPreview'
import { StatusBadge } from '@/components/common/StatusBadge'
import RenewButton from '@/components/pelanggan/RenewButton'
import {
  HiOutlineUser,
  HiOutlineMapPin,
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlinePhone,
  HiOutlineEnvelope,
  HiOutlineCreditCard,
  HiOutlineKey,
  HiOutlinePhoto,
  HiPencil,
  HiTrash,
  HiOutlineExclamationTriangle,
  HiOutlineCalendar,
  HiArrowPath
} from 'react-icons/hi2'

// Force dynamic rendering untuk menghindari cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PelangganPPPDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id },
    include: {
      hargaPaket: {
        include: {
          profilePPP: true,
          bandwidth: true,
        },
      },
    },
  })

  if (!pelanggan) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Detail Pelanggan PPP</h1>
          <Link href="/admin/pelanggan/ppp" className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">
            Kembali
          </Link>
        </div>
        <div className="text-sm text-gray-500">Pelanggan tidak ditemukan.</div>
      </div>
    )
  }

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateShort = (date: Date) => {
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  const isJatuhTempo = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const jatuhTempoDate = new Date(pelanggan.jatuhTempo)
    jatuhTempoDate.setHours(0, 0, 0, 0)
    return jatuhTempoDate < today
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{pelanggan.nama}</h1>
            <StatusBadge status={pelanggan.status} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            ID Pelanggan: {pelanggan.idPelanggan} • Username: {pelanggan.username}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/pelanggan/ppp"
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Kembali
          </Link>
          <RenewButton pelangganId={pelanggan.id} />
          <Link
            href={`/admin/pelanggan/ppp/${pelanggan.id}/edit`}
            className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
          >
            <HiPencil className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Paket Langganan"
          value={pelanggan.hargaPaket?.name || '-'}
          color="blue"
          icon={<HiOutlineCreditCard className="w-5 h-5" />}
        />
        <StatCard
          label="Harga Paket"
          value={pelanggan.hargaPaket ? formatRupiah(pelanggan.hargaPaket.harga) : '-'}
          color="green"
          icon={<HiOutlineCreditCard className="w-5 h-5" />}
        />
        <StatCard
          label="Jatuh Tempo"
          value={isJatuhTempo() ? (
            <span className="flex items-center gap-1">
              <HiOutlineExclamationTriangle className="w-4 h-4" /> Jatuh Tempo
            </span>
          ) : formatDate(pelanggan.jatuhTempo)}
          color={isJatuhTempo() ? 'red' : 'blue'}
          icon={<HiOutlineClock className="w-5 h-5" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informasi Dasar */}
          <InfoCard
            title="Informasi Dasar"
            icon={<HiOutlineUser className="w-4 h-4" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem
                label="ID Pelanggan"
                value={pelanggan.idPelanggan}
                icon={<HiOutlineUser className="w-3 h-3" />}
              />
              <InfoItem
                label="Nama Lengkap"
                value={pelanggan.nama}
                icon={<HiOutlineUser className="w-3 h-3" />}
              />
              <InfoItem
                label="Username PPPoE"
                value={pelanggan.username}
                icon={<HiOutlineKey className="w-3 h-3" />}
              />
              <InfoItem
                label="Tipe Pelanggan"
                value={
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pelanggan.tipe === 'REGULER'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                    {pelanggan.tipe === 'REGULER' ? (
                      <>
                        <HiOutlineCalendar className="w-3 h-3 mr-1" /> Reguler
                      </>
                    ) : (
                      <>
                        <HiArrowPath className="w-3 h-3 mr-1" /> Non Reguler
                      </>
                    )}
                  </span>
                }
                icon={<HiOutlineUser className="w-3 h-3" />}
              />
              <InfoItem
                label="Tanggal Aktif"
                value={formatDate(pelanggan.tanggalAktif)}
                icon={<HiOutlineClock className="w-3 h-3" />}
              />
              <InfoItem
                label="Jatuh Tempo"
                value={
                  <span className={isJatuhTempo() ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                    {formatDate(pelanggan.jatuhTempo)}
                    {isJatuhTempo() && <HiOutlineExclamationTriangle className="w-3 h-3 inline ml-1" />}
                  </span>
                }
                icon={<HiOutlineClock className="w-3 h-3" />}
              />
            </div>
          </InfoCard>

          {/* Informasi Kontak */}
          <InfoCard
            title="Informasi Kontak"
            icon={<HiOutlinePhone className="w-4 h-4" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pelanggan.noTelp && (
                <InfoItem
                  label="Nomor Telepon"
                  value={pelanggan.noTelp}
                  icon={<HiOutlinePhone className="w-3 h-3" />}
                />
              )}
              {pelanggan.email && (
                <InfoItem
                  label="Email"
                  value={pelanggan.email}
                  icon={<HiOutlineEnvelope className="w-3 h-3" />}
                />
              )}
              {pelanggan.alamat && (
                <InfoItem
                  label="Alamat"
                  value={pelanggan.alamat}
                  icon={<HiOutlineMapPin className="w-3 h-3" />}
                />
              )}
              {pelanggan.kecamatan && (
                <InfoItem
                  label="Kecamatan"
                  value={pelanggan.kecamatan}
                  icon={<HiOutlineMapPin className="w-3 h-3" />}
                />
              )}
              {pelanggan.kelurahanDesa && (
                <InfoItem
                  label="Kelurahan/Desa"
                  value={pelanggan.kelurahanDesa}
                  icon={<HiOutlineMapPin className="w-3 h-3" />}
                />
              )}
              {pelanggan.kabupatenKota && (
                <InfoItem
                  label="Kabupaten/Kota"
                  value={pelanggan.kabupatenKota}
                  icon={<HiOutlineMapPin className="w-3 h-3" />}
                />
              )}
              {pelanggan.provinsi && (
                <InfoItem
                  label="Provinsi"
                  value={pelanggan.provinsi}
                  icon={<HiOutlineMapPin className="w-3 h-3" />}
                />
              )}
            </div>
          </InfoCard>

          {/* Informasi Dokumen */}
          {(pelanggan.jenisDokumen || pelanggan.noDokumen) && (
            <InfoCard
              title="Informasi Dokumen"
              icon={<HiOutlineDocumentText className="w-4 h-4" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pelanggan.jenisDokumen && (
                  <InfoItem
                    label="Jenis Dokumen"
                    value={pelanggan.jenisDokumen}
                    icon={<HiOutlineDocumentText className="w-3 h-3" />}
                  />
                )}
                {pelanggan.noDokumen && (
                  <InfoItem
                    label="Nomor Dokumen"
                    value={pelanggan.noDokumen}
                    icon={<HiOutlineDocumentText className="w-3 h-3" />}
                  />
                )}
              </div>
            </InfoCard>
          )}

          {/* File Uploads */}
          {(pelanggan.fileKTP || pelanggan.fileRumahSekitar || pelanggan.fileBAST) && (
            <InfoCard
              title="Dokumen Terlampir"
              icon={<HiOutlinePhoto className="w-4 h-4" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {pelanggan.fileKTP && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">File KTP</label>
                    <a
                      href={pelanggan.fileKTP}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                        <HiOutlinePhoto className="w-4 h-4" />
                        <span>Lihat KTP</span>
                      </div>
                    </a>
                  </div>
                )}
                {pelanggan.fileRumahSekitar && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">File Rumah Sekitar</label>
                    <a
                      href={pelanggan.fileRumahSekitar}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                        <HiOutlinePhoto className="w-4 h-4" />
                        <span>Lihat Rumah</span>
                      </div>
                    </a>
                  </div>
                )}
                {pelanggan.fileBAST && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">File BAST</label>
                    <a
                      href={pelanggan.fileBAST}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                        <HiOutlinePhoto className="w-4 h-4" />
                        <span>Lihat BAST</span>
                      </div>
                    </a>
                  </div>
                )}
              </div>
            </InfoCard>
          )}

          {/* Catatan */}
          {pelanggan.catatan && (
            <InfoCard
              title="Catatan"
              icon={<HiOutlineDocumentText className="w-4 h-4" />}
            >
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {pelanggan.catatan}
              </p>
            </InfoCard>
          )}
        </div>

        {/* Right Column - Additional Info */}
        <div className="space-y-6">
          {/* Paket Information */}
          {pelanggan.hargaPaket && (
            <InfoCard
              title="Paket Langganan"
              icon={<HiOutlineCreditCard className="w-4 h-4" />}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Nama Paket</label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {pelanggan.hargaPaket.name}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Harga</label>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                    {formatRupiah(pelanggan.hargaPaket.harga)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Durasi</label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {pelanggan.hargaPaket.durasi} {pelanggan.hargaPaket.durasiUnit === 'JAM' ? 'Jam' : pelanggan.hargaPaket.durasiUnit === 'HARI' ? 'Hari' : pelanggan.hargaPaket.durasiUnit === 'BULAN' ? 'Bulan' : 'Tahun'}
                  </p>
                </div>
                {pelanggan.hargaPaket.profilePPP && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Profile PPP</label>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      {pelanggan.hargaPaket.profilePPP.name}
                    </p>
                  </div>
                )}
                {pelanggan.hargaPaket.bandwidth && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Bandwidth</label>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      {pelanggan.hargaPaket.bandwidth.name}
                    </p>
                  </div>
                )}
              </div>
            </InfoCard>
          )}

          {/* Map Preview */}
          {pelanggan.latitude && pelanggan.longitude && (
            <InfoCard
              title="Lokasi"
              icon={<HiOutlineMapPin className="w-4 h-4" />}
            >
              <MapPreview
                lat={pelanggan.latitude}
                lon={pelanggan.longitude}
                height={200}
              />
            </InfoCard>
          )}

          {/* Informasi Tagihan */}
          <InfoCard
            title="Informasi Tagihan"
            icon={<HiOutlineCreditCard className="w-4 h-4" />}
          >
            <div className="space-y-4">
              {/* Paket Terpilih */}
              {pelanggan.hargaPaket && (
                <div className="space-y-2 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Paket Terpilih</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {pelanggan.hargaPaket.name}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Durasi: {pelanggan.hargaPaket.durasi} {pelanggan.hargaPaket.durasiUnit === 'JAM' ? 'jam' : pelanggan.hargaPaket.durasiUnit === 'HARI' ? 'hari' : pelanggan.hargaPaket.durasiUnit === 'BULAN' ? 'bulan' : 'tahun'}
                    </div>
                    {pelanggan.hargaPaket.profilePPP && (
                      <div className="text-gray-600 dark:text-gray-400">
                        Profile: {pelanggan.hargaPaket.profilePPP.name}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rincian Tagihan */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Rincian Tagihan</h4>

                {/* Harga Paket */}
                {pelanggan.hargaPaket && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Harga Paket</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatRupiah(pelanggan.hargaPaket.harga)}
                    </span>
                  </div>
                )}

                {/* Biaya Instalasi */}
                {pelanggan.biayaInstalasi && pelanggan.biayaInstalasi > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Biaya Instalasi {pelanggan.biayaInstalasiIsRecurring ? '(Berulang)' : '(1x)'}
                        {pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            - Diskon {pelanggan.biayaInstalasiDiskon}%
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatRupiah(
                          pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0
                            ? pelanggan.biayaInstalasi - (pelanggan.biayaInstalasi * pelanggan.biayaInstalasiDiskon / 100)
                            : pelanggan.biayaInstalasi
                        )}
                      </span>
                    </div>
                    {pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                        (Sebelum diskon: {formatRupiah(pelanggan.biayaInstalasi)})
                      </div>
                    )}
                  </div>
                )}

                {/* Biaya Sewa Perangkat */}
                {pelanggan.biayaSewaPerangkat && pelanggan.biayaSewaPerangkat > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Biaya Sewa Perangkat {pelanggan.biayaSewaPerangkatIsRecurring ? '(Berulang)' : '(1x)'}
                        {pelanggan.biayaSewaPerangkatDiskon && pelanggan.biayaSewaPerangkatDiskon > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            - Diskon {pelanggan.biayaSewaPerangkatDiskon}%
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatRupiah(
                          pelanggan.biayaSewaPerangkatDiskon && pelanggan.biayaSewaPerangkatDiskon > 0
                            ? pelanggan.biayaSewaPerangkat - (pelanggan.biayaSewaPerangkat * pelanggan.biayaSewaPerangkatDiskon / 100)
                            : pelanggan.biayaSewaPerangkat
                        )}
                      </span>
                    </div>
                    {pelanggan.biayaSewaPerangkatDiskon && pelanggan.biayaSewaPerangkatDiskon > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                        (Sebelum diskon: {formatRupiah(pelanggan.biayaSewaPerangkat)})
                      </div>
                    )}
                  </div>
                )}

                {/* Biaya Lainnya */}
                {pelanggan.biayaLainnya && pelanggan.biayaLainnya > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Biaya Lainnya {pelanggan.biayaLainnyaIsRecurring ? '(Berulang)' : '(1x)'}
                        {pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            - Diskon {pelanggan.biayaLainnyaDiskon}%
                          </span>
                        )}
                        {pelanggan.keteranganBiayaLainnya && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            ({pelanggan.keteranganBiayaLainnya})
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatRupiah(
                          pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0
                            ? pelanggan.biayaLainnya - (pelanggan.biayaLainnya * pelanggan.biayaLainnyaDiskon / 100)
                            : pelanggan.biayaLainnya
                        )}
                      </span>
                    </div>
                    {pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                        (Sebelum diskon: {formatRupiah(pelanggan.biayaLainnya)})
                      </div>
                    )}
                  </div>
                )}

                {/* Diskon - Prioritas: custom diskon pelanggan > diskon paket */}
                {pelanggan.useDiscount && (() => {
                  const hargaPaket = pelanggan.hargaPaket?.harga || 0
                  let diskon = 0
                  let diskonInfo = null

                  // Gunakan custom diskon pelanggan jika ada
                  if (pelanggan.discountType && pelanggan.discountValue !== null) {
                    if (pelanggan.discountType === 'FIXED') {
                      diskon = pelanggan.discountValue
                    } else if (pelanggan.discountType === 'PERCENT') {
                      diskon = (hargaPaket * pelanggan.discountValue) / 100
                    }
                    diskonInfo = {
                      type: pelanggan.discountType,
                      value: pelanggan.discountValue,
                      duration: pelanggan.discountDuration,
                      durationUnit: pelanggan.discountDurationUnit,
                      isCustom: true,
                    }
                  }
                  // Fallback ke diskon paket jika custom diskon tidak diisi
                  else if (pelanggan.hargaPaket?.useDiscount && pelanggan.hargaPaket?.discountType && pelanggan.hargaPaket?.discountValue) {
                    if (pelanggan.hargaPaket.discountType === 'FIXED') {
                      diskon = pelanggan.hargaPaket.discountValue
                    } else if (pelanggan.hargaPaket.discountType === 'PERCENT') {
                      diskon = (hargaPaket * pelanggan.hargaPaket.discountValue) / 100
                    }
                    diskonInfo = {
                      type: pelanggan.hargaPaket.discountType,
                      value: pelanggan.hargaPaket.discountValue,
                      duration: pelanggan.hargaPaket.discountDuration,
                      durationUnit: pelanggan.hargaPaket.discountDurationUnit,
                      isCustom: false,
                    }
                  }

                  if (diskon > 0 && diskonInfo) {
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Diskon {diskonInfo.isCustom ? '(Custom)' : '(Paket)'}
                          </span>
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            - {formatRupiah(diskon)}
                          </span>
                        </div>
                        {diskonInfo.duration && diskonInfo.durationUnit && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            (Berlaku selama {diskonInfo.duration} {diskonInfo.durationUnit === 'JAM' ? 'jam' : diskonInfo.durationUnit === 'HARI' ? 'hari' : diskonInfo.durationUnit === 'BULAN' ? 'bulan' : 'tahun'})
                          </div>
                        )}
                      </div>
                    )
                  }
                  return null
                })()}

                {/* PPN - dihitung dari subtotal setelah diskon */}
                {pelanggan.usePPN && pelanggan.hargaPaket?.usePPN && pelanggan.hargaPaket?.ppnPercentage && (() => {
                  const hargaPaket = pelanggan.hargaPaket?.harga || 0
                  let subtotal = hargaPaket

                  // Kurangi diskon jika ada
                  if (pelanggan.useDiscount) {
                    if (pelanggan.discountType && pelanggan.discountValue !== null) {
                      if (pelanggan.discountType === 'FIXED') {
                        subtotal -= pelanggan.discountValue
                      } else if (pelanggan.discountType === 'PERCENT') {
                        subtotal -= (subtotal * pelanggan.discountValue / 100)
                      }
                    } else if (pelanggan.hargaPaket?.useDiscount && pelanggan.hargaPaket?.discountType && pelanggan.hargaPaket?.discountValue) {
                      if (pelanggan.hargaPaket.discountType === 'FIXED') {
                        subtotal -= pelanggan.hargaPaket.discountValue
                      } else if (pelanggan.hargaPaket.discountType === 'PERCENT') {
                        subtotal -= (subtotal * pelanggan.hargaPaket.discountValue / 100)
                      }
                    }
                  }

                  const ppn = (subtotal * pelanggan.hargaPaket.ppnPercentage) / 100

                  return (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        PPN ({pelanggan.hargaPaket.ppnPercentage}%)
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        + {formatRupiah(ppn)}
                      </span>
                    </div>
                  )
                })()}

              </div>

              {/* Total Tagihan */}
              <div className="pt-3 border-t-2 border-gray-300 dark:border-gray-600">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    Total Tagihan
                  </span>
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {(() => {
                      const hargaPaket = pelanggan.hargaPaket?.harga || 0
                      let subtotal = hargaPaket

                      // Kurangi diskon jika ada (prioritas: custom > paket)
                      if (pelanggan.useDiscount) {
                        if (pelanggan.discountType && pelanggan.discountValue !== null) {
                          if (pelanggan.discountType === 'FIXED') {
                            subtotal -= pelanggan.discountValue
                          } else if (pelanggan.discountType === 'PERCENT') {
                            subtotal -= (subtotal * pelanggan.discountValue / 100)
                          }
                        } else if (pelanggan.hargaPaket?.useDiscount && pelanggan.hargaPaket?.discountType && pelanggan.hargaPaket?.discountValue) {
                          if (pelanggan.hargaPaket.discountType === 'FIXED') {
                            subtotal -= pelanggan.hargaPaket.discountValue
                          } else if (pelanggan.hargaPaket.discountType === 'PERCENT') {
                            subtotal -= (subtotal * pelanggan.hargaPaket.discountValue / 100)
                          }
                        }
                      }
                      subtotal = Math.max(0, subtotal)

                      // Tambahkan PPN jika ada (dari subtotal setelah diskon)
                      let ppn = 0
                      if (pelanggan.usePPN && pelanggan.hargaPaket?.usePPN && pelanggan.hargaPaket?.ppnPercentage) {
                        ppn = (subtotal * pelanggan.hargaPaket.ppnPercentage) / 100
                      }

                      // Tambahkan biaya instalasi
                      let biayaInstalasi = 0
                      if (pelanggan.biayaInstalasi && pelanggan.biayaInstalasi > 0) {
                        biayaInstalasi = pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0
                          ? pelanggan.biayaInstalasi - (pelanggan.biayaInstalasi * pelanggan.biayaInstalasiDiskon / 100)
                          : pelanggan.biayaInstalasi
                      }

                      // Tambahkan biaya sewa perangkat
                      let biayaSewa = 0
                      if (pelanggan.biayaSewaPerangkat && pelanggan.biayaSewaPerangkat > 0) {
                        biayaSewa = pelanggan.biayaSewaPerangkatDiskon && pelanggan.biayaSewaPerangkatDiskon > 0
                          ? pelanggan.biayaSewaPerangkat - (pelanggan.biayaSewaPerangkat * pelanggan.biayaSewaPerangkatDiskon / 100)
                          : pelanggan.biayaSewaPerangkat
                      }

                      // Tambahkan biaya lainnya
                      let biayaLainnya = 0
                      if (pelanggan.biayaLainnya && pelanggan.biayaLainnya > 0) {
                        biayaLainnya = pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0
                          ? pelanggan.biayaLainnya - (pelanggan.biayaLainnya * pelanggan.biayaLainnyaDiskon / 100)
                          : pelanggan.biayaLainnya
                      }

                      const total = subtotal + ppn + biayaInstalasi + biayaSewa + biayaLainnya
                      return formatRupiah(Math.max(0, total))
                    })()}
                  </span>
                </div>
              </div>

              {/* Pengaturan */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">PPN</span>
                  <span className={`font-medium ${pelanggan.usePPN ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    {pelanggan.usePPN ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Prorate</span>
                  <span className={`font-medium ${pelanggan.useProrate ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                    {pelanggan.useProrate ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Diskon</span>
                    <span className={`font-medium ${pelanggan.useDiscount ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                      {pelanggan.useDiscount ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </div>
                  {pelanggan.useDiscount && (() => {
                    const hargaPaket = pelanggan.hargaPaket?.harga || 0
                    let diskonInfo = null

                    if (pelanggan.discountType && pelanggan.discountValue !== null) {
                      diskonInfo = {
                        type: pelanggan.discountType,
                        value: pelanggan.discountValue,
                        duration: pelanggan.discountDuration,
                        durationUnit: pelanggan.discountDurationUnit,
                        isCustom: true,
                      }
                    } else if (pelanggan.hargaPaket?.useDiscount && pelanggan.hargaPaket?.discountType && pelanggan.hargaPaket?.discountValue) {
                      diskonInfo = {
                        type: pelanggan.hargaPaket.discountType,
                        value: pelanggan.hargaPaket.discountValue,
                        duration: pelanggan.hargaPaket.discountDuration,
                        durationUnit: pelanggan.hargaPaket.discountDurationUnit,
                        isCustom: false,
                      }
                    }

                    if (diskonInfo) {
                      return (
                        <div className="text-gray-500 dark:text-gray-400">
                          {diskonInfo.isCustom ? 'Custom' : 'Paket'}: {diskonInfo.type === 'FIXED' ? formatRupiah(diskonInfo.value) : `${diskonInfo.value}%`}
                          {diskonInfo.duration && diskonInfo.durationUnit && (
                            <> - Durasi: {diskonInfo.duration} {diskonInfo.durationUnit === 'JAM' ? 'jam' : diskonInfo.durationUnit === 'HARI' ? 'hari' : diskonInfo.durationUnit === 'BULAN' ? 'bulan' : 'tahun'}</>
                          )}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              </div>

              {/* Periode Layanan */}
              {pelanggan.tanggalAktif && pelanggan.jatuhTempo && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Periode Layanan
                  </h4>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Aktif:</span>
                      <span className="font-medium">
                        {formatDateShort(pelanggan.tanggalAktif)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Jatuh Tempo:</span>
                      <span className="font-medium">
                        {formatDateShort(pelanggan.jatuhTempo)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </InfoCard>
        </div>
      </div>
    </div>
  )
}

