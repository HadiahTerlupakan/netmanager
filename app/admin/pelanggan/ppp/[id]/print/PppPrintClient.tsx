'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiPrinter, HiXCircle } from 'react-icons/hi2'
import Image from 'next/image'
import PageLoader from '@/components/ui/PageLoader'

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

export default function PppPrintClient() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [pelanggan, setPelanggan] = useState<Pelanggan | null>(null)
  const [tagihan, setTagihan] = useState<Tagihan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPPPAccount, setShowPPPAccount] = useState(false)
  const [logoSettings, setLogoSettings] = useState<{ logoInvoice?: string } | null>(null)
  const [generalSettings, setGeneralSettings] = useState<{
    perusahaan?: string
    alamat?: string
    nomorHp?: string
    deskripsiInvoice?: string
  } | null>(null)
  const [printFormat, setPrintFormat] = useState<'A4' | 'THERMAL'>('A4')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch pelanggan data
        const pelangganRes = await fetch(`/api/pelanggan-ppp/${id}`)
        if (!pelangganRes.ok) {
          throw new Error('Failed to fetch pelanggan data')
        }
        const pelangganData = await pelangganRes.json()
        // The API returns the raw object directly now, not { pelanggan: ... }
        if (pelangganData.id) {
          setPelanggan(pelangganData)
        } else if (pelangganData.pelanggan) {
          setPelanggan(pelangganData.pelanggan)
        } else {
          console.error("Unknown pelanggan format", pelangganData);
        }

        // Fetch latest tagihan
        const tagihanRes = await fetch(`/api/tagihan/pelanggan/${id}?latest=true`)
        if (tagihanRes.ok) {
          const tagihanData = await tagihanRes.json()
          console.log('PRINT TAGIHAN RES:', tagihanData)
          if (tagihanData.data?.tagihan) {
            setTagihan(tagihanData.data.tagihan)
          } else if (tagihanData.tagihan) {
            setTagihan(tagihanData.tagihan)
          }
        }

        // Fetch logo settings
        try {
          const logoRes = await fetch('/api/settings/logo/public')
          if (logoRes.ok) {
            const logoData = await logoRes.json()
            if (logoData.logoInvoice) {
              let normalizedPath = logoData.logoInvoice.trim()
              if (!normalizedPath.startsWith('/')) {
                normalizedPath = '/' + normalizedPath.replace(/^\//, '')
              }
              logoData.logoInvoice = normalizedPath
              const testImg = new window.Image()
              testImg.onload = () => {
                console.log('Logo image loaded successfully:', normalizedPath)
              }
              testImg.onerror = () => {
                console.warn('Logo tidak dapat diakses, akan menggunakan fallback:', normalizedPath)
              }
              testImg.src = normalizedPath
            }
            setLogoSettings(logoData)
          }
        } catch (_e) {
          console.warn('Failed to load logo settings')
        }

        // Fetch general settings
        try {
          const generalRes = await fetch('/api/settings/general/public')
          if (generalRes.ok) {
            const generalData = await generalRes.json()
            setGeneralSettings(generalData)
          }
        } catch (_e) {
          console.warn('Failed to load general settings')
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchData()
    }
  }, [id])

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
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

  // Jika tagihan tidak ada secara realita, kita buat draft cetakan (Preview Mode) hanya agar fungsi Print bisa jalan (sebagai Draft)
  const currentTagihan = tagihan || {
    id: '-',
    status: 'BELUM_LUNAS' as const,
    createdAt: pelanggan?.tanggalAktif || new Date().toISOString(),
    issueDate: pelanggan?.tanggalAktif || new Date().toISOString(),
    jatuhTempo: pelanggan?.jatuhTempo || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
    dueDate: pelanggan?.jatuhTempo || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
    total: pelanggan?.hargaPaket?.harga || 0,
    metodePembayaran: '-',
    keterangan: 'Belum ada tagihan tercatat',
    nomor: 'DRAFT',
    noTagihan: 'DRAFT',
    invoiceNumber: 'DRAFT',
    subtotal: Number(pelanggan?.hargaPaket?.harga || 0),
    ppn: 0,
    biayaInstalasi: pelanggan?.biayaInstalasi || 0,
    biayaSewaPerangkat: pelanggan?.biayaSewaPerangkat || 0,
    biayaLainnya: pelanggan?.biayaLainnya || 0,
    diskon: 0
  }

  const invoiceCalculations = (() => {
    if (!currentTagihan) return null

    return {
      hargaPaket: currentTagihan.subtotal, // Subtotal includes all base prices based on current mapping
      diskon: currentTagihan.diskon || 0,
      biayaInstalasi: currentTagihan.biayaInstalasi || 0,
      biayaSewa: currentTagihan.biayaSewaPerangkat || 0,
      biayaLainnya: currentTagihan.biayaLainnya || 0,
      subtotal: currentTagihan.subtotal, // Real subtotal of all items
      ppn: currentTagihan.ppn || 0,
      total: currentTagihan.total || 0
    }
  })()
  // Helper strings
  const getAlamatLengkap = () => {
    if (!pelanggan) return ''
    return [
      pelanggan.alamat,
      pelanggan.kelurahanDesa,
      pelanggan.kecamatan,
      pelanggan.kabupatenKota,
      pelanggan.provinsi,
    ].filter(Boolean).join(', ')
  }


  if (loading) {
    return <PageLoader />
  }



  if (error || !pelanggan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4 text-4xl text-red-500">
            <HiXCircle className="w-16 h-16 mx-auto" />
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">
            {error || (!pelanggan ? 'Data pelanggan tidak ditemukan' : 'Terjadi kesalahan tidak diketahui')}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400"
          >
            <span className="text-white">Kembali</span>
          </button>
        </div>
      </div>
    )
  }

  // Format nomor invoice untuk konfirmasi pelanggan ke admin
  // Support format lama (TAG-YYYYMM-XXXX) dan format baru (INVXXXXYYYYZZZZ)
  // Menampilkan nomor tagihan tanpa prefix TAG- atau INV
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let invoiceNumber = currentTagihan.noTagihan || (currentTagihan as any).nomor || (currentTagihan as any).invoiceNumber || "-"
  if (invoiceNumber && invoiceNumber.startsWith('INV')) {
    // Format baru: INVXXXXYYYYZZZZ -> XXXXYYYYZZZZ
    invoiceNumber = invoiceNumber.replace(/^INV/, '')
  } else if (invoiceNumber && invoiceNumber.startsWith('TAG-')) {
    // Format lama: TAG-YYYYMM-XXXX -> YYYYMM-XXXX (tanpa prefix TAG-)
    invoiceNumber = invoiceNumber.replace(/^TAG-/, '')
  }

  return (
    <div className="min-h-screen bg-gray-50 print:h-auto print:min-h-0 print:bg-white print:overflow-visible">
      <style jsx global>{`
        @media print {
          html, body {
            width: auto !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Sembunyikan semua elemen layout admin */
          nav, aside, header, footer, .sidebar, .navbar, .no-print {
            display: none !important;
          }
          
          /* Targetkan semua wrapper layout mulai dari root hingga main */
          #__next, body > div, .min-h-screen, .flex-1, main, .print-content-wrapper {
             height: auto !important;
             min-height: auto !important;
             overflow: visible !important;
             display: block !important;
             position: static !important;
             background: white !important;
             margin: 0 !important;
             padding: 0 !important;
          }
          
          .invoice-paper {
             max-width: 100% !important;
             width: 100% !important;
             margin: 0 !important;
             padding: 15mm 20mm !important; /* Gunakan padding sbg margin pengganti page */
             box-shadow: none !important;
             background: white !important;
             border: none !important;
          }
          
          .invoice-bill-to {
             background: transparent !important;
             padding: 0 !important;
             border: none !important;
          }
          
          .invoice-text-dark {
             color: black !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          @page {
            size: ${printFormat === 'THERMAL' ? '58mm auto' : 'A4'};
            margin: 0mm; /* Margin 0 untuk MENGHILANGKAN Date & URL bawaan Browser (Chrome/Edge) */
          }
        }
      `}</style>

      {/* Wrapper */}
      <div className={`print-content-wrapper bg-gray-50 dark:bg-gray-950 min-h-screen print:min-h-0 text-gray-900 ${printFormat === 'THERMAL' ? 'font-mono' : 'font-sans'} print:bg-white print:text-black`}>

        {/* Control Bar */}
        <div className="print:hidden fixed top-0 right-0 left-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-between items-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Preview Invoice</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={showPPPAccount}
                onChange={(e) => setShowPPPAccount(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Show PPP Info</span>
            </label>
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

            <select
              value={printFormat}
              onChange={(e) => setPrintFormat(e.target.value as 'A4' | 'THERMAL')}
              className="text-sm py-1.5 px-3 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="A4">A4 Normal</option>
              <option value="THERMAL">Struk Thermal</option>
            </select>

            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border-input shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 shadow-sm flex items-center gap-2"
            >
              <HiPrinter className="w-4 h-4 text-white" />
              <span className="text-white">Print Invoice</span>
            </button>
          </div>
        </div>

        {printFormat === 'THERMAL' ? (
          /* THERMAL 58mm Layout */
          <div className="invoice-paper mx-auto bg-white p-[5mm] pt-[10mm] shadow-2xl print:shadow-none print:p-0" style={{ maxWidth: '58mm', width: '58mm' }}>
            <div className="text-center mb-4">
              <h1 className="font-bold text-lg mb-1">{generalSettings?.perusahaan || 'Perusahaan'}</h1>
              <p className="text-[10px] leading-tight mb-0.5">{generalSettings?.alamat || '-'}</p>
              <p className="text-[10px] leading-tight">{generalSettings?.nomorHp || '-'}</p>
              <p className="text-[10px] my-2 border-b border-dashed border-gray-400 pb-2">
                INV: {invoiceNumber}
              </p>
            </div>

            <div className="text-[10px] mb-3 space-y-1">
              <div className="flex justify-between">
                <span>Pelanggan</span>
                <span className="font-medium text-right max-w-[50%] truncate">{pelanggan.nama}</span>
              </div>
              <div className="flex justify-between">
                <span>ID</span>
                <span>{pelanggan.idPelanggan}</span>
              </div>
              {showPPPAccount && (
                <div className="flex justify-between">
                  <span>PPP</span>
                  <span>{pelanggan.username}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Issued</span>
                <span>{formatDateShort((currentTagihan as any).issueDate || currentTagihan.createdAt as string)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tempo</span>
                <span>{formatDateShort(currentTagihan.jatuhTempo || (currentTagihan as any).dueDate as string)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1">
                <span>Status</span>
                <span className="uppercase">{currentTagihan.status === 'LUNAS' || (currentTagihan as any).status === 'PAID' ? 'PAID' : 'UNPAID'}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 py-2 my-2">
              <div className="text-[10px] font-bold mb-1">Items:</div>
              {pelanggan.hargaPaket && (
                <div className="text-[10px] mb-1.5 flex justify-between items-start">
                  <div className="max-w-[65%]">
                    <div>{pelanggan.hargaPaket.name}</div>
                    <div className="text-[9px] text-gray-500">{getPeriodeAktif()}</div>
                  </div>
                  <div>{formatRupiah(invoiceCalculations?.hargaPaket || 0)}</div>
                </div>
              )}

              {invoiceCalculations?.biayaInstalasi ? (
                <div className="text-[10px] mb-1.5 flex justify-between">
                  <span>Instalasi</span>
                  <span>{formatRupiah(invoiceCalculations.biayaInstalasi)}</span>
                </div>
              ) : null}
            </div>

            <div className="border-t border-dashed border-gray-400 py-2 my-2 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span>Subtotal</span>
                <span>{formatRupiah(invoiceCalculations?.subtotal || 0)}</span>
              </div>
              {(invoiceCalculations?.diskon || 0) > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span>Diskon</span>
                  <span>- {formatRupiah(invoiceCalculations?.diskon || 0)}</span>
                </div>
              )}
              {(invoiceCalculations?.ppn || 0) > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span>PPN/Tax</span>
                  <span>{formatRupiah(invoiceCalculations?.ppn || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[12px] pt-1 border-t border-gray-300 mt-1">
                <span>Total</span>
                <span>{formatRupiah(invoiceCalculations?.total || 0)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] border-t border-dashed border-gray-400 pt-3 mt-4 mb-2">
              <p>Terima Kasih</p>
              <p>{generalSettings?.perusahaan}</p>
            </div>
          </div>
        ) : (
          /* A4 Invoice Container */
          <div className="invoice-paper max-w-[210mm] mx-auto bg-white p-[20mm] pt-[30mm] shadow-2xl">

            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-200 print:border-gray-800 pb-8 mb-8">
              <div className="w-[60%]">
                {logoSettings?.logoInvoice ? (
                  <div className="relative h-12 w-full mb-6">
                    <Image
                      src={logoSettings.logoInvoice}
                      alt="Company Logo"
                      fill
                      className="object-contain object-left"
                      unoptimized={true}
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 bg-indigo-50 rounded flex items-center justify-center mb-6 text-indigo-600 font-bold text-xl">
                    {generalSettings?.perusahaan?.charAt(0) || 'C'}
                  </div>
                )}
                <div className="text-sm text-gray-500 space-y-1">
                  <p className="font-semibold text-gray-900 text-lg mb-1">{generalSettings?.perusahaan}</p>
                  <p>{generalSettings?.alamat}</p>
                  <p>{generalSettings?.nomorHp}</p>
                </div>
              </div>

              <div className="text-right w-[40%]">
                <h2 className="text-3xl font-light text-gray-900 tracking-tight mb-3">INVOICE</h2>

                <div className="flex justify-end mb-6">
                  <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${currentTagihan.status === 'LUNAS' || (currentTagihan as any).status === 'PAID'
                    ? 'bg-green-50 text-green-700 ring-green-600/20'
                    : 'bg-red-50 text-red-700 ring-red-600/10'
                    }`}>
                    {currentTagihan.status === 'LUNAS' || (currentTagihan as any).status === 'PAID' ? 'PAID' : 'UNPAID'}
                  </span>
                </div>

                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-end gap-8">
                    <dt className="text-gray-500 min-w-[80px]">Invoice #</dt>
                    <dd className="font-mono font-medium text-gray-900">{invoiceNumber}</dd>
                  </div>
                  <div className="flex justify-end gap-8">
                    <dt className="text-gray-500 min-w-[80px]">Issued</dt>
                    <dd className="font-medium text-gray-900">{formatDateShort((currentTagihan as any).issueDate || currentTagihan.createdAt as string)}</dd>
                  </div>
                  <div className="flex justify-end gap-8">
                    <dt className="text-gray-500 min-w-[80px]">Due Date</dt>
                    <dd className="font-medium text-gray-900">{formatDateShort(currentTagihan.jatuhTempo || (currentTagihan as any).dueDate as string)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-12">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bill To</h3>
              <div className="invoice-bill-to bg-gray-50 rounded-lg p-6 border border-gray-100/50">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-base font-bold text-gray-900 mb-0.5">{pelanggan.nama}</p>
                    <p className="text-xs text-gray-400 mb-3">ID: {pelanggan.idPelanggan}</p>
                    <div className="text-sm text-gray-600 leading-relaxed">
                      {getAlamatLengkap() || <p className="text-gray-400 italic">No address provided</p>}
                    </div>
                  </div>
                  <div className="space-y-4 text-right">
                    {(pelanggan.noTelp || pelanggan.email) && (
                      <div className="space-y-1">
                        {pelanggan.noTelp && <p className="text-sm text-gray-900">{pelanggan.noTelp}</p>}
                        {pelanggan.email && <p className="text-sm text-gray-600">{pelanggan.email}</p>}
                      </div>
                    )}
                    {showPPPAccount && (
                      <div className="inline-block text-left bg-white px-3 py-2 rounded border border-gray-200 shadow-sm">
                        <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">PPP Account</p>
                        <p className="text-sm font-mono text-gray-700">{pelanggan.username}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Services Table */}
            <div className="mb-10">
              <table className="min-w-full divide-y divide-gray-200 print:divide-gray-800 border-t border-gray-200 print:border-gray-800">
                <thead>
                  <tr className="bg-gray-50/50 print:bg-transparent">
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 sm:pl-0">Description</th>
                    <th scope="col" className="px-3 py-3.5 text-center text-xs font-semibold text-gray-900">Period</th>
                    <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold text-gray-900">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 print:divide-gray-400 bg-white">
                  {/* Main Package */}
                  {pelanggan.hargaPaket && (
                    <tr>
                      <td className="py-4 pl-4 pr-3 text-sm sm:pl-0">
                        <div className="font-medium text-gray-900">{pelanggan.hargaPaket.name}</div>
                        <div className="text-gray-500 mt-0.5 text-xs">{generalSettings?.deskripsiInvoice || 'Internet Service Subscription'}</div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 text-center">
                        {getPeriodeAktif()}
                      </td>
                      <td className="px-3 py-4 text-sm font-medium text-right text-gray-900 tabular-nums">
                        {formatRupiah(invoiceCalculations?.hargaPaket || 0)}
                      </td>
                    </tr>
                  )}

                  {/* Fees & Discounts */}
                  {invoiceCalculations?.biayaInstalasi ? (
                    <tr>
                      <td className="py-4 pl-4 pr-3 text-sm sm:pl-0">
                        <div className="font-medium text-gray-900">Installation Fee</div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 text-center">-</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900 tabular-nums">
                        {formatRupiah(invoiceCalculations.biayaInstalasi)}
                      </td>
                    </tr>
                  ) : null}

                  {invoiceCalculations?.biayaSewa ? (
                    <tr>
                      <td className="py-4 pl-4 pr-3 text-sm sm:pl-0">
                        <div className="font-medium text-gray-900">Device Rental</div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 text-center">-</td>
                      <td className="px-3 py-4 text-sm text-right text-gray-900 tabular-nums">
                        {formatRupiah(invoiceCalculations.biayaSewa)}
                      </td>
                    </tr>
                  ) : null}

                  {/* Discount moved to Totals Box for cleaner accounting presentation */}
                </tbody>
              </table>
            </div>

            {/* Totals Box */}
            {invoiceCalculations && (
              <div className="flex justify-end mb-12">
                <div className="w-1/2 sm:w-[40%] space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium text-gray-900">{formatRupiah(invoiceCalculations.subtotal)}</span>
                  </div>
                  {invoiceCalculations.diskon > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">- {formatRupiah(invoiceCalculations.diskon)}</span>
                    </div>
                  )}
                  {invoiceCalculations.ppn > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>VAT ({pelanggan.usePPN ? (pelanggan.hargaPaket?.ppnPercentage || 11) : 0}%)</span>
                      <span className="font-medium text-gray-900">{formatRupiah(invoiceCalculations.ppn)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-indigo-600">{formatRupiah(invoiceCalculations.total)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Areas */}
            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-gray-100">
              <div>
                <h4 className="font-semibold text-gray-900 text-sm mb-2">Payment Info</h4>
                <div className="text-xs text-gray-500 leading-relaxed">
                  <p>Make all checks payable to <span className="font-medium text-gray-900">{generalSettings?.perusahaan || 'Perusahaan'}</span></p>
                  <p className="mt-1">For bank transfer, please use the Invoice Number as reference.</p>
                </div>
              </div>
              <div className="text-right">
                <h4 className="font-semibold text-gray-900 text-sm mb-2">Terms & Conditions</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Service will be checked automatically upon payment.
                  Please contact support for billing discrepancies.
                </p>
              </div>
            </div>

            <div className="mt-16 text-center">
              <p className="text-xs text-gray-400">Thank you for your business!</p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
