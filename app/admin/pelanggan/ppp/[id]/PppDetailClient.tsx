import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import React from 'react'
import MapPreview from '@/components/common/MapPreview'
import { StatusBadge } from '@/components/common/StatusBadge'
import CustomerInvoiceHistory from './CustomerInvoiceHistory'

import {
  HiPencil,
  HiOutlineUser,
  HiOutlineMapPin,
  HiOutlineServer,
  HiOutlineCreditCard,
  HiOutlineDocumentText,
  HiOutlinePhoto
} from 'react-icons/hi2'

// Force dynamic rendering untuk menghindari cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper component untuk baris data formulir
const FormField = ({ label, value, className = '' }: { label: string, value: React.ReactNode, className?: string }) => (
  <div className={`flex flex-col sm:flex-row sm:items-baseline border-b border-gray-100 dark:border-gray-800 py-3 last:border-0 ${className}`}>
    <dt className="w-full sm:w-1/3 text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="w-full sm:w-2/3 text-sm font-medium text-gray-900 dark:text-white mt-1 sm:mt-0">{value || '-'}</dd>
  </div>
)

const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType, title: string }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-indigo-500 dark:border-indigo-400">
    <Icon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
    <h2 className="text-base font-bold uppercase tracking-wide text-gray-900 dark:text-white">
      {title}
    </h2>
  </div>
)

export async function ClientComponent({ params }: { params: Promise<{ id: string }> }) {
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
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Pelanggan tidak ditemukan. <Link href="/admin/pelanggan/ppp" className="underline font-bold">Kembali</Link>
        </div>
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

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header Action Bar */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href="/admin/pelanggan/ppp"
            className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            ← Kembali ke Daftar
          </Link>
          <div className="flex gap-3">
            <Link
              href={`/admin/pelanggan/ppp/${pelanggan.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
            >
              <HiPencil className="w-4 h-4 text-white" />
              <span className="text-white">Edit Data</span>
            </Link>
          </div>
        </div>

        {/* Main "Form" Paper */}
        <div className="bg-white dark:bg-gray-900 shadow-xl shadow-gray-200/50 dark:shadow-black/20 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">

          {/* Form Header / Letterhead style */}
          <div className="bg-linear-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-8 border-b border-gray-200 dark:border-gray-800">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Formulir Data Pelanggan
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                  PT. NetManager Internet Service Provider
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
                  <StatusBadge status={pelanggan.status} />
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 uppercase tracking-wider">ID Pelanggan</div>
                  <div className="text-lg font-mono font-bold text-gray-900 dark:text-white">{pelanggan.idPelanggan}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">

            {/* LEFT COLUMN */}
            <div className="space-y-8">
              {/* I. IDENTITAS PRIBADI */}
              <section>
                <SectionHeader icon={HiOutlineUser} title="I. Identitas Pribadi" />
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg px-4 border border-gray-100 dark:border-gray-800">
                  <FormField label="Nama Lengkap" value={pelanggan.nama} />
                  <FormField label="Nomor Identitas (KTP/SIM)" value={pelanggan.noDokumen} />
                  <FormField label="Jenis Dokumen" value={pelanggan.jenisDokumen} />
                </div>
              </section>

              {/* II. KONTAK & ALAMAT */}
              <section>
                <SectionHeader icon={HiOutlineMapPin} title="II. Kontak & Alamat" />
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg px-4 border border-gray-100 dark:border-gray-800">
                  <FormField label="Nomor Telepon/WA" value={pelanggan.noTelp} />
                  <FormField label="Email" value={pelanggan.email} />
                  <FormField label="Alamat Lengkap" value={pelanggan.alamat} />
                  <FormField label="Kelurahan / Desa" value={pelanggan.kelurahanDesa} />
                  <FormField label="Kecamatan" value={pelanggan.kecamatan} />
                  <FormField label="Kabupaten / Kota" value={pelanggan.kabupatenKota} />
                  <FormField label="Provinsi" value={pelanggan.provinsi} />
                  {pelanggan.latitude && pelanggan.longitude && (
                    <div className="py-4">
                      <div className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Titik Koordinat Lokasi</div>
                      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                        <MapPreview lat={pelanggan.latitude} lon={pelanggan.longitude} height={200} />
                      </div>
                      <div className="mt-2 text-xs font-mono text-gray-400 flex gap-4">
                        <span>Lat: {pelanggan.latitude}</span>
                        <span>Long: {pelanggan.longitude}</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-8">
              {/* III. PAKET LAYANAN */}
              <section>
                <SectionHeader icon={HiOutlineCreditCard} title="III. Paket & Layanan" />
                <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-lg px-4 border border-indigo-100 dark:border-indigo-900/30">
                  <FormField label="Nama Paket" value={<span className="font-bold text-indigo-700 dark:text-indigo-400">{pelanggan.hargaPaket?.name}</span>} />
                  <FormField label="Biaya Berlangganan" value={<span className="font-bold text-gray-900 dark:text-white">{pelanggan.hargaPaket ? formatRupiah(pelanggan.hargaPaket.harga) : '-'}</span>} />
                  <FormField label="Kecepatan / Bandwidth" value={pelanggan.hargaPaket?.bandwidth?.name || '-'} />
                  <FormField label="Jenis Layanan" value={
                    pelanggan.tipe ? (
                      <span className="capitalize">{pelanggan.tipe.toLowerCase()}</span>
                    ) : '-'
                  } />
                  <FormField label="Tanggal Pasang (Aktif)" value={pelanggan.tanggalAktif ? formatDate(pelanggan.tanggalAktif) : '-'} />
                  <FormField label="Jatuh Tempo Pembayaran" value={
                    pelanggan.jatuhTempo ? (
                      <div className="flex items-center gap-2">
                        <span>Setiap tanggal {new Date(pelanggan.jatuhTempo).getDate()}</span>
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                          (Next: {formatDate(pelanggan.jatuhTempo)})
                        </span>
                      </div>
                    ) : '-'
                  } />
                </div>
              </section>

              {/* IV. DATA TEKNIS */}
              <section>
                <SectionHeader icon={HiOutlineServer} title="IV. Data Teknis" />
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg px-4 border border-gray-100 dark:border-gray-800">
                  <FormField label="Username PPPoE" value={<code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono text-indigo-600 dark:text-indigo-400">{pelanggan.username}</code>} />
                  <FormField label="Profile Plan" value={pelanggan.hargaPaket?.profilePPP?.name || '-'} />
                  <FormField label="IP Address (Static)" value={'-'} /* Field placeholder if needed */ />
                  <FormField label="Server / Router" value={'-'} /* Field placeholder if needed */ />
                  <FormField label="ODP / Port" value={'-'} /* Field placeholder if needed */ />
                  <FormField label="SN Perangkat (ONT)" value={'-'} /* Field placeholder if needed */ />
                </div>
              </section>

              {/* V. CATATAN & LAMPIRAN */}
              <section>
                <SectionHeader icon={HiOutlineDocumentText} title="V. Catatan & Lampiran" />
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-4 border border-gray-100 dark:border-gray-800 space-y-4">
                  {pelanggan.catatan ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300 italic p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded">
                      &quot;{pelanggan.catatan}&quot;
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic">Tidak ada catatan tambahan.</div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {pelanggan.fileKTP && (
                      <a href={pelanggan.fileKTP} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                        <HiOutlinePhoto className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Foto Identitas/KTP</span>
                      </a>
                    )}
                    {pelanggan.fileRumahSekitar && (
                      <a href={pelanggan.fileRumahSekitar} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                        <HiOutlinePhoto className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Foto Lokasi</span>
                      </a>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* VI. RIWAYAT TAGIHAN & PEMBAYARAN */}
          <div className="p-8 pt-0">
            <CustomerInvoiceHistory pelangganId={pelanggan.id} />
          </div>

          {/* Footer - Signature / Validation placeholder */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-8 border-t border-gray-200 dark:border-gray-800 mt-0">
            <div className="flex flex-col sm:flex-row justify-between items-end gap-8">
              <div className="text-xs text-gray-400">
                <p>Dokumen ini digenerate secara otomatis oleh sistem.</p>
                <p>Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
              </div>
              <div className="hidden sm:block text-center">
                <div className="h-20 w-32 border-b border-gray-300 dark:border-gray-600 mb-2"></div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Admin / Petugas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
