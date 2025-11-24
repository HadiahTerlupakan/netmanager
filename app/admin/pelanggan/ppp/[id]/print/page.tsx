'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiPrinter, HiXMark } from 'react-icons/hi2'

type Pelanggan = {
  id: string
  idPelanggan: string
  nama: string
  username: string
  tipe: 'REGULER' | 'NON_REGULER'
  alamat?: string | null
  provinsi?: string | null
  kabupatenKota?: string | null
  kelurahanDesa?: string | null
  kecamatan?: string | null
  noTelp?: string | null
  email?: string | null
  tanggalAktif: string
  jatuhTempo: string
  usePPN: boolean
  useDiscount: boolean
  useProrate: boolean
  discountType?: 'FIXED' | 'PERCENT' | null
  discountValue?: number | null
  discountDuration?: number | null
  discountDurationUnit?: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null
  biayaInstalasi?: number | null
  biayaInstalasiIsRecurring?: boolean
  biayaInstalasiDiskon?: number | null
  biayaSewaPerangkat?: number | null
  biayaSewaPerangkatIsRecurring?: boolean
  biayaSewaPerangkatDiskon?: number | null
  biayaLainnya?: number | null
  biayaLainnyaIsRecurring?: boolean
  biayaLainnyaDiskon?: number | null
  keteranganBiayaLainnya?: string | null
  hargaPaket?: {
    id: string
    name: string
    harga: number
    durasi: number
    durasiUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
    usePPN?: boolean
    ppnPercentage?: number | null
    useDiscount?: boolean
    discountType?: 'FIXED' | 'PERCENT' | null
    discountValue?: number | null
    discountDuration?: number | null
    discountDurationUnit?: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null
    profilePPP?: {
      name: string
    } | null
    bandwidth?: {
      name: string
    } | null
  } | null
}

type Tagihan = {
  id: string
  noTagihan: string
  periodeBulan: number
  periodeTahun: number
  subtotal: number
  diskon: number
  ppn: number
  biayaInstalasi: number
  biayaSewaPerangkat: number
  biayaLainnya: number
  total: number
  status: 'BELUM_LUNAS' | 'LUNAS' | 'TERLAMBAT'
  jatuhTempo: string
  tanggalBayar: string | null
  metodePembayaran: string | null
  createdAt: string
}

const namaBulan = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

type GeneralSettings = {
  perusahaan: string
  alamat: string
  nomorHp: string
  deskripsiInvoice: string
}

export default function PrintTagihanPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [showPPPAccount, setShowPPPAccount] = useState(false)
  const [pelanggan, setPelanggan] = useState<Pelanggan | null>(null)
  const [tagihan, setTagihan] = useState<Tagihan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const id = params.id as string

        // Load pengaturan umum (public endpoint untuk invoice)
        const settingsRes = await fetch('/api/settings/general/public')
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          setGeneralSettings(settingsData)
        }

        // Load pelanggan dengan paket
        const pelangganRes = await fetch(`/api/pelanggan-ppp/${id}`)
        if (!pelangganRes.ok) {
          throw new Error('Gagal memuat data pelanggan')
        }
        const pelangganData = await pelangganRes.json()
        setPelanggan(pelangganData)

        // Load tagihan terakhir (belum lunas atau yang terbaru)
        const tagihanRes = await fetch(`/api/tagihan/pelanggan/${id}`)
        if (tagihanRes.ok) {
          const tagihans = await tagihanRes.json()
          const tagihanBelumLunas = tagihans.find(
            (t: Tagihan) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT',
          )
          const tagihanTerbaru = tagihans.sort((a: Tagihan, b: Tagihan) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0]

          setTagihan(tagihanBelumLunas || tagihanTerbaru || null)
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [params.id])

  useEffect(() => {
    // Auto print saat halaman dimuat
    if (!loading && tagihan) {
      // Delay sedikit untuk memastikan semua data ter-render
      setTimeout(() => {
        window.print()
      }, 500)
    }
  }, [loading, tagihan])

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const getPeriodeAktif = () => {
    if (!pelanggan?.hargaPaket) return ''
    const { durasi, durasiUnit } = pelanggan.hargaPaket
    const unitMap: Record<string, string> = {
      JAM: durasi === 1 ? 'Jam' : 'Jam',
      HARI: durasi === 1 ? 'Hari' : 'Hari',
      BULAN: durasi === 1 ? 'Bulan' : 'Bulan',
      TAHUN: durasi === 1 ? 'Tahun' : 'Tahun',
    }
    return `${durasi} ${unitMap[durasiUnit] || durasiUnit}`
  }

  const getAlamatLengkap = () => {
    if (!pelanggan) return ''
    const parts = [
      pelanggan.alamat,
      pelanggan.kelurahanDesa,
      pelanggan.kecamatan,
      pelanggan.kabupatenKota,
      pelanggan.provinsi,
    ].filter(Boolean)
    return parts.join(', ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (error || !pelanggan || !tagihan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4 text-4xl">❌</div>
          <p className="text-sm text-red-600 dark:text-red-400">
            {error || 'Data tidak ditemukan'}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Kembali
          </button>
        </div>
      </div>
    )
  }

  // Konversi nomor tagihan ke format INV-XXXXX
  // Gunakan ID tagihan yang di-hash atau nomor tagihan
  const invoiceNumber = `INV-${tagihan.id.replace(/-/g, '').substring(0, 12)}`

  return (
    <div className="min-h-screen bg-white">
      {/* Header untuk print - tombol kontrol */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex items-center gap-2 bg-white border border-gray-300 rounded-lg shadow-lg p-2">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer px-2">
          <input
            type="checkbox"
            checked={showPPPAccount}
            onChange={(e) => setShowPPPAccount(e.target.checked)}
            className="w-4 h-4"
          />
          <span>Show PPP Account on Print Result [A4 Only]</span>
        </label>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-sm"
        >
          <HiPrinter className="w-4 h-4" />
          Print
        </button>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-sm"
        >
          <HiXMark className="w-4 h-4" />
          Close
        </button>
      </div>

      {/* Invoice Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-0">
        {/* Header Invoice */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-gray-300 pb-6">
          {/* Logo & Company Info */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg
                className="w-12 h-12 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-blue-600 mb-1">
                {generalSettings?.perusahaan || 'Perusahaan'}
              </h1>
              {generalSettings?.perusahaan && (
                <p className="text-sm text-green-600 font-medium">{generalSettings.perusahaan}</p>
              )}
            </div>
          </div>

          {/* Invoice Title & Status */}
          <div className="text-right">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-4xl font-bold text-gray-900">INVOICE</h2>
              <div className="w-px h-12 bg-gray-300"></div>
              <div>
                <p
                  className={`text-2xl font-bold ${
                    tagihan.status === 'LUNAS' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {tagihan.status === 'LUNAS' ? 'LUNAS' : 'BELUM BAYAR'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">Number : #{invoiceNumber}</p>
          </div>
        </div>

        {/* Billing Information */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* Ditagihkan ke */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Ditagihkan ke</h3>
            <div className="text-sm text-gray-900 space-y-1">
              <p className="font-semibold">
                {pelanggan.nama} | {pelanggan.idPelanggan}
              </p>
              <p>{getAlamatLengkap() || pelanggan.alamat || '-'}</p>
              {pelanggan.noTelp && <p>{pelanggan.noTelp}</p>}
              {showPPPAccount && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">Username PPPoE:</p>
                  <p className="font-mono text-xs">{pelanggan.username}</p>
                </div>
              )}
            </div>
          </div>

          {/* Dibayarkan ke */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Dibayarkan ke</h3>
            <div className="text-sm text-gray-900 space-y-1">
              <p className="font-semibold">{generalSettings?.perusahaan || '-'}</p>
              <p>{generalSettings?.alamat || '-'}</p>
              <p>{generalSettings?.nomorHp || '-'}</p>
            </div>
          </div>
        </div>

        {/* Ringkasan Layanan Table */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ringkasan Layanan</h3>
          <div className="border border-gray-300 rounded overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-300">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Paket Langganan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Jatuh Tempo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Periode Aktif
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Jumlah
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {/* Harga Paket */}
                {pelanggan.hargaPaket && (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {pelanggan.hargaPaket.name}
                      {generalSettings?.deskripsiInvoice && (
                        <span className="text-gray-500"> ({generalSettings.deskripsiInvoice})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(tagihan.jatuhTempo)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {getPeriodeAktif()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatRupiah(pelanggan.hargaPaket.harga)}
                    </td>
                  </tr>
                )}

                {/* Diskon */}
                {(() => {
                  const hargaPaket = pelanggan.hargaPaket?.harga || 0
                  let diskon = 0
                  let diskonInfo: any = null

                  if (pelanggan.useDiscount) {
                    if (
                      pelanggan.discountType &&
                      pelanggan.discountValue !== null &&
                      pelanggan.discountDuration &&
                      pelanggan.discountDurationUnit
                    ) {
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
                    } else if (
                      pelanggan.hargaPaket?.useDiscount &&
                      pelanggan.hargaPaket?.discountType &&
                      pelanggan.hargaPaket?.discountValue &&
                      pelanggan.hargaPaket?.discountDuration &&
                      pelanggan.hargaPaket?.discountDurationUnit
                    ) {
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
                  }

                  if (diskon > 0 && diskonInfo) {
                    return (
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          Diskon {diskonInfo.isCustom ? '(Custom)' : '(Paket)'}
                          {diskonInfo.duration && diskonInfo.durationUnit && (
                            <span className="text-xs text-gray-500 ml-1">
                              - Durasi: {diskonInfo.duration}{' '}
                              {diskonInfo.durationUnit === 'JAM'
                                ? 'jam'
                                : diskonInfo.durationUnit === 'HARI'
                                  ? 'hari'
                                  : diskonInfo.durationUnit === 'BULAN'
                                    ? 'bulan'
                                    : 'tahun'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">—</td>
                        <td className="px-4 py-3 text-sm text-gray-400">—</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                          - {formatRupiah(Math.round(diskon))}
                        </td>
                      </tr>
                    )
                  }
                  return null
                })()}


                {/* Biaya Instalasi */}
                {pelanggan.biayaInstalasi && pelanggan.biayaInstalasi > 0 && (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div>
                          Biaya Instalasi {pelanggan.biayaInstalasiIsRecurring ? '(Berulang)' : '(1x)'}
                          {pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              - Diskon {pelanggan.biayaInstalasiDiskon}%
                            </span>
                          )}
                        </div>
                        {pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            (Sebelum diskon: {formatRupiah(pelanggan.biayaInstalasi)})
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">—</td>
                    <td className="px-4 py-3 text-sm text-gray-400">—</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      +{' '}
                      {formatRupiah(
                        pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0
                          ? pelanggan.biayaInstalasi -
                              (pelanggan.biayaInstalasi * pelanggan.biayaInstalasiDiskon) / 100
                          : pelanggan.biayaInstalasi,
                      )}
                    </td>
                  </tr>
                )}

                {/* Biaya Sewa Perangkat */}
                {pelanggan.biayaSewaPerangkat && pelanggan.biayaSewaPerangkat > 0 && (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div>
                          Biaya Sewa Perangkat (Berulang)
                          {pelanggan.biayaSewaPerangkatDiskon &&
                            pelanggan.biayaSewaPerangkatDiskon > 0 && (
                              <span className="text-xs text-gray-500 ml-1">
                                - Diskon {pelanggan.biayaSewaPerangkatDiskon}%
                              </span>
                            )}
                        </div>
                        {pelanggan.biayaSewaPerangkatDiskon &&
                          pelanggan.biayaSewaPerangkatDiskon > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              (Sebelum diskon: {formatRupiah(pelanggan.biayaSewaPerangkat)})
                            </div>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">—</td>
                    <td className="px-4 py-3 text-sm text-gray-400">—</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      +{' '}
                      {formatRupiah(
                        pelanggan.biayaSewaPerangkatDiskon &&
                          pelanggan.biayaSewaPerangkatDiskon > 0
                          ? pelanggan.biayaSewaPerangkat -
                              (pelanggan.biayaSewaPerangkat *
                                pelanggan.biayaSewaPerangkatDiskon) /
                                100
                          : pelanggan.biayaSewaPerangkat,
                      )}
                    </td>
                  </tr>
                )}

                {/* Biaya Lainnya */}
                {pelanggan.biayaLainnya && pelanggan.biayaLainnya > 0 && (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div>
                          Biaya Lainnya {pelanggan.biayaLainnyaIsRecurring ? '(Berulang)' : '(1x)'}
                          {pelanggan.keteranganBiayaLainnya && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({pelanggan.keteranganBiayaLainnya})
                            </span>
                          )}
                          {pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              - Diskon {pelanggan.biayaLainnyaDiskon}%
                            </span>
                          )}
                        </div>
                        {pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            (Sebelum diskon: {formatRupiah(pelanggan.biayaLainnya)})
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">—</td>
                    <td className="px-4 py-3 text-sm text-gray-400">—</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      +{' '}
                      {formatRupiah(
                        pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0
                          ? pelanggan.biayaLainnya -
                              (pelanggan.biayaLainnya * pelanggan.biayaLainnyaDiskon) / 100
                          : pelanggan.biayaLainnya,
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8">
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Sub Total</span>
                <span className="font-medium text-gray-900">
                  {(() => {
                    // Hitung subtotal = harga paket setelah diskon + semua biaya tambahan
                    const hargaPaket = pelanggan.hargaPaket?.harga || 0
                    let subtotalPaket = hargaPaket
                    
                    // Kurangi diskon paket
                    if (pelanggan.useDiscount) {
                      if (pelanggan.discountType && pelanggan.discountValue !== null) {
                        if (pelanggan.discountType === 'FIXED') {
                          subtotalPaket -= pelanggan.discountValue
                        } else if (pelanggan.discountType === 'PERCENT') {
                          subtotalPaket -= (subtotalPaket * pelanggan.discountValue / 100)
                        }
                      } else if (pelanggan.hargaPaket?.useDiscount && pelanggan.hargaPaket?.discountType && pelanggan.hargaPaket?.discountValue) {
                        if (pelanggan.hargaPaket.discountType === 'FIXED') {
                          subtotalPaket -= pelanggan.hargaPaket.discountValue
                        } else if (pelanggan.hargaPaket.discountType === 'PERCENT') {
                          subtotalPaket -= (subtotalPaket * pelanggan.hargaPaket.discountValue / 100)
                        }
                      }
                    }
                    subtotalPaket = Math.max(0, subtotalPaket)
                    
                    // Tambahkan semua biaya tambahan
                    let biayaInstalasi = 0
                    if (pelanggan.biayaInstalasi && pelanggan.biayaInstalasi > 0) {
                      biayaInstalasi = pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0
                        ? pelanggan.biayaInstalasi - (pelanggan.biayaInstalasi * pelanggan.biayaInstalasiDiskon / 100)
                        : pelanggan.biayaInstalasi
                    }
                    
                    let biayaSewa = 0
                    if (pelanggan.biayaSewaPerangkat && pelanggan.biayaSewaPerangkat > 0) {
                      biayaSewa = pelanggan.biayaSewaPerangkatDiskon && pelanggan.biayaSewaPerangkatDiskon > 0
                        ? pelanggan.biayaSewaPerangkat - (pelanggan.biayaSewaPerangkat * pelanggan.biayaSewaPerangkatDiskon / 100)
                        : pelanggan.biayaSewaPerangkat
                    }
                    
                    let biayaLainnya = 0
                    if (pelanggan.biayaLainnya && pelanggan.biayaLainnya > 0) {
                      biayaLainnya = pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0
                        ? pelanggan.biayaLainnya - (pelanggan.biayaLainnya * pelanggan.biayaLainnyaDiskon / 100)
                        : pelanggan.biayaLainnya
                    }
                    
                    // Subtotal = paket setelah diskon + semua biaya tambahan
                    const subtotal = subtotalPaket + biayaInstalasi + biayaSewa + biayaLainnya
                    return formatRupiah(Math.round(subtotal))
                  })()}
                </span>
              </div>
              {(() => {
                // Hitung PPN dari subtotal keseluruhan (paket + biaya tambahan)
                const hargaPaket = pelanggan.hargaPaket?.harga || 0
                let subtotalPaket = hargaPaket
                
                if (pelanggan.useDiscount) {
                  if (pelanggan.discountType && pelanggan.discountValue !== null) {
                    if (pelanggan.discountType === 'FIXED') {
                      subtotalPaket -= pelanggan.discountValue
                    } else if (pelanggan.discountType === 'PERCENT') {
                      subtotalPaket -= (subtotalPaket * pelanggan.discountValue / 100)
                    }
                  } else if (pelanggan.hargaPaket?.useDiscount && pelanggan.hargaPaket?.discountType && pelanggan.hargaPaket?.discountValue) {
                    if (pelanggan.hargaPaket.discountType === 'FIXED') {
                      subtotalPaket -= pelanggan.hargaPaket.discountValue
                    } else if (pelanggan.hargaPaket.discountType === 'PERCENT') {
                      subtotalPaket -= (subtotalPaket * pelanggan.hargaPaket.discountValue / 100)
                    }
                  }
                }
                subtotalPaket = Math.max(0, subtotalPaket)
                
                // Tambahkan semua biaya tambahan
                let biayaInstalasi = 0
                if (pelanggan.biayaInstalasi && pelanggan.biayaInstalasi > 0) {
                  biayaInstalasi = pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0
                    ? pelanggan.biayaInstalasi - (pelanggan.biayaInstalasi * pelanggan.biayaInstalasiDiskon / 100)
                    : pelanggan.biayaInstalasi
                }
                
                let biayaSewa = 0
                if (pelanggan.biayaSewaPerangkat && pelanggan.biayaSewaPerangkat > 0) {
                  biayaSewa = pelanggan.biayaSewaPerangkatDiskon && pelanggan.biayaSewaPerangkatDiskon > 0
                    ? pelanggan.biayaSewaPerangkat - (pelanggan.biayaSewaPerangkat * pelanggan.biayaSewaPerangkatDiskon / 100)
                    : pelanggan.biayaSewaPerangkat
                }
                
                let biayaLainnya = 0
                if (pelanggan.biayaLainnya && pelanggan.biayaLainnya > 0) {
                  biayaLainnya = pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0
                    ? pelanggan.biayaLainnya - (pelanggan.biayaLainnya * pelanggan.biayaLainnyaDiskon / 100)
                    : pelanggan.biayaLainnya
                }
                
                // Subtotal keseluruhan = paket setelah diskon + semua biaya tambahan
                const subtotalKeseluruhan = subtotalPaket + biayaInstalasi + biayaSewa + biayaLainnya
                
                // PPN dihitung dari subtotal keseluruhan
                let ppn = 0
                if (pelanggan.usePPN && pelanggan.hargaPaket?.usePPN && pelanggan.hargaPaket?.ppnPercentage) {
                  ppn = (subtotalKeseluruhan * pelanggan.hargaPaket.ppnPercentage) / 100
                }
                
                if (ppn > 0) {
                  return (
                    <div className="flex justify-between text-sm">
                      <div>
                        <span className="text-gray-700">PPN (VAT)</span>
                        <p className="text-xs text-gray-500">
                          based on company & country regulation
                        </p>
                      </div>
                      <span className="font-medium text-gray-900">{formatRupiah(Math.round(ppn))}</span>
                    </div>
                  )
                }
                return null
              })()}
              <div className="flex justify-between text-base font-bold pt-2 border-t-2 border-gray-300">
                <span className="text-gray-900">Total</span>
                <span className="text-xl font-bold text-purple-600">
                  {(() => {
                    // Hitung total = subtotal keseluruhan + PPN
                    const hargaPaket = pelanggan.hargaPaket?.harga || 0
                    let subtotalPaket = hargaPaket
                    
                    if (pelanggan.useDiscount) {
                      if (pelanggan.discountType && pelanggan.discountValue !== null) {
                        if (pelanggan.discountType === 'FIXED') {
                          subtotalPaket -= pelanggan.discountValue
                        } else if (pelanggan.discountType === 'PERCENT') {
                          subtotalPaket -= (subtotalPaket * pelanggan.discountValue / 100)
                        }
                      } else if (pelanggan.hargaPaket?.useDiscount && pelanggan.hargaPaket?.discountType && pelanggan.hargaPaket?.discountValue) {
                        if (pelanggan.hargaPaket.discountType === 'FIXED') {
                          subtotalPaket -= pelanggan.hargaPaket.discountValue
                        } else if (pelanggan.hargaPaket.discountType === 'PERCENT') {
                          subtotalPaket -= (subtotalPaket * pelanggan.hargaPaket.discountValue / 100)
                        }
                      }
                    }
                    subtotalPaket = Math.max(0, subtotalPaket)
                    
                    // Tambahkan semua biaya tambahan
                    let biayaInstalasi = 0
                    if (pelanggan.biayaInstalasi && pelanggan.biayaInstalasi > 0) {
                      biayaInstalasi = pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0
                        ? pelanggan.biayaInstalasi - (pelanggan.biayaInstalasi * pelanggan.biayaInstalasiDiskon / 100)
                        : pelanggan.biayaInstalasi
                    }
                    
                    let biayaSewa = 0
                    if (pelanggan.biayaSewaPerangkat && pelanggan.biayaSewaPerangkat > 0) {
                      biayaSewa = pelanggan.biayaSewaPerangkatDiskon && pelanggan.biayaSewaPerangkatDiskon > 0
                        ? pelanggan.biayaSewaPerangkat - (pelanggan.biayaSewaPerangkat * pelanggan.biayaSewaPerangkatDiskon / 100)
                        : pelanggan.biayaSewaPerangkat
                    }
                    
                    let biayaLainnya = 0
                    if (pelanggan.biayaLainnya && pelanggan.biayaLainnya > 0) {
                      biayaLainnya = pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0
                        ? pelanggan.biayaLainnya - (pelanggan.biayaLainnya * pelanggan.biayaLainnyaDiskon / 100)
                        : pelanggan.biayaLainnya
                    }
                    
                    // Subtotal keseluruhan = paket setelah diskon + semua biaya tambahan
                    const subtotalKeseluruhan = subtotalPaket + biayaInstalasi + biayaSewa + biayaLainnya
                    
                    // PPN dihitung dari subtotal keseluruhan
                    let ppn = 0
                    if (pelanggan.usePPN && pelanggan.hargaPaket?.usePPN && pelanggan.hargaPaket?.ppnPercentage) {
                      ppn = (subtotalKeseluruhan * pelanggan.hargaPaket.ppnPercentage) / 100
                    }
                    
                    // Total = subtotal keseluruhan + PPN
                    const total = subtotalKeseluruhan + ppn
                    return formatRupiah(Math.round(total))
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Instructions */}
        <div className="mb-8 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Transfer Manual</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                <span className="text-blue-600 underline">Tidak Terima</span>{' '}
                <span className="text-green-600 underline">Tranfer Manual</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Pembayaran Tunai</h4>
            <div className="text-sm text-gray-900 space-y-1">
              <p className="font-semibold">{generalSettings?.perusahaan || '-'}</p>
              <p>{generalSettings?.alamat || '-'}</p>
              <p>{generalSettings?.nomorHp || '-'}</p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 pt-6 border-t border-gray-300">
          <p className="text-xs text-gray-600">
            <span className="font-bold">NOTE:</span> This is computer generated receipt and does not
            require physical signature.
          </p>
        </div>
      </div>

      {/* CSS untuk Print */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
            margin: 0;
            padding: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
        }
      `}</style>
    </div>
  )
}
