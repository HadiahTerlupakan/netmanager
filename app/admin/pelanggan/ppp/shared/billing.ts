export type PppDurationUnit = 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'

export type PppHargaPaketLike = {
  id: string
  harga: number
  durasi: number
  durasiUnit: PppDurationUnit
  usePPN?: boolean
  ppnPercentage?: number | null
  useDiscount?: boolean
  discountType?: 'FIXED' | 'PERCENT' | null
  discountValue?: number | null
  discountDuration?: number | null
  discountDurationUnit?: PppDurationUnit | null
}

export type PppBillingFormLike = {
  hargaPaketId: string
  usePPN: boolean
  useDiscount: boolean
  useProrate: boolean
  tanggalAktif: string
  jatuhTempo: string
  discountType: 'FIXED' | 'PERCENT' | null
  discountValue: number | null
  discountDuration: number | null
  discountDurationUnit: PppDurationUnit | null
  biayaInstalasi: number | null
  useDiskonBiayaInstalasi: boolean
  biayaInstalasiDiskon: number | null
  biayaSewaPerangkat: number | null
  useDiskonSewaPerangkat: boolean
  biayaSewaPerangkatDiskon: number | null
  biayaLainnya: number | null
  useDiskonBiayaLainnya: boolean
  biayaLainnyaDiskon: number | null
}

type DiskonInfo = {
  type: 'FIXED' | 'PERCENT'
  value: number
  duration: number | null | undefined
  durationUnit: PppDurationUnit | null | undefined
  isCustom: boolean
}

type ProrateInfo = {
  selisihHari: number
  durasiPaketHari: number
  ratio: number
  hargaSebelumProrate: number
  hargaSetelahProrate: number
}

export type PppBillingResult<TPaket extends PppHargaPaketLike> = {
  hargaPaket: number
  diskon: number
  ppn: number
  subtotal: number
  biayaInstalasi: number
  biayaSewaPerangkat: number
  biayaLainnya: number
  totalBiayaLainnya: number
  total: number
  paket: TPaket
  diskonInfo: DiskonInfo | null
  prorateInfo: ProrateInfo | null
  biayaInstalasiDiskon: number | null
  biayaInstalasiSebelumDiskon: number
  biayaSewaPerangkatDiskon: number | null
  biayaSewaPerangkatSebelumDiskon: number
  biayaLainnyaDiskon: number | null
  biayaLainnyaSebelumDiskon: number
}

export function calculatePppDueDate<TPaket extends PppHargaPaketLike>(
  tanggalAktif: string | undefined,
  hargaPaketId: string | undefined,
  hargaPakets: TPaket[]
): string {
  if (!tanggalAktif || !hargaPaketId || hargaPakets.length === 0) {
    return ''
  }

  const selectedPaket = hargaPakets.find((paket) => paket.id === hargaPaketId)
  if (!selectedPaket) {
    return ''
  }

  const startDate = new Date(tanggalAktif)
  const jatuhTempo = new Date(startDate)

  switch (selectedPaket.durasiUnit) {
    case 'JAM':
      jatuhTempo.setHours(jatuhTempo.getHours() + selectedPaket.durasi)
      break
    case 'HARI':
      jatuhTempo.setDate(jatuhTempo.getDate() + selectedPaket.durasi)
      break
    case 'BULAN':
      jatuhTempo.setMonth(jatuhTempo.getMonth() + selectedPaket.durasi)
      break
    case 'TAHUN':
      jatuhTempo.setFullYear(jatuhTempo.getFullYear() + selectedPaket.durasi)
      break
  }

  return jatuhTempo.toISOString().split('T')[0] ?? ''
}

const getPackageDurationInDays = (paket: PppHargaPaketLike): number => {
  switch (paket.durasiUnit) {
    case 'JAM':
      return paket.durasi / 24
    case 'HARI':
      return paket.durasi
    case 'BULAN':
      return paket.durasi * 30
    case 'TAHUN':
      return paket.durasi * 365
  }
}

const applyPercentageDiscount = (amount: number, percentage: number | null): number => {
  if (!percentage || percentage <= 0) {
    return amount
  }

  return Math.max(0, amount - (amount * percentage) / 100)
}

export function calculatePppBilling<TPaket extends PppHargaPaketLike>(
  formData: PppBillingFormLike,
  hargaPakets: TPaket[],
  options?: { allowNonPositiveProrate?: boolean }
): PppBillingResult<TPaket> | null {
  if (!formData.hargaPaketId || hargaPakets.length === 0) {
    return null
  }

  const selectedPaket = hargaPakets.find((paket) => paket.id === formData.hargaPaketId)
  if (!selectedPaket) {
    return null
  }

  let subtotal = selectedPaket.harga
  let prorateInfo: ProrateInfo | null = null

  if (formData.useProrate && formData.tanggalAktif && formData.jatuhTempo) {
    const tanggalAktif = new Date(formData.tanggalAktif)
    const jatuhTempo = new Date(formData.jatuhTempo)

    if (!Number.isNaN(tanggalAktif.getTime()) && !Number.isNaN(jatuhTempo.getTime())) {
      const selisihHari = Math.ceil((jatuhTempo.getTime() - tanggalAktif.getTime()) / (1000 * 60 * 60 * 24))
      const durasiPaketHari = getPackageDurationInDays(selectedPaket)
      const canUseProrate = options?.allowNonPositiveProrate
        ? durasiPaketHari > 0
        : durasiPaketHari > 0 && selisihHari > 0

      if (canUseProrate) {
        const prorateRatio = selisihHari / durasiPaketHari
        const hargaSebelumProrate = subtotal
        subtotal = Math.round(subtotal * prorateRatio)
        prorateInfo = {
          selisihHari,
          durasiPaketHari,
          ratio: prorateRatio,
          hargaSebelumProrate,
          hargaSetelahProrate: subtotal,
        }
      }
    }
  }

  let diskon = 0
  let diskonInfo: DiskonInfo | null = null

  if (formData.useDiscount) {
    if (formData.discountType && formData.discountValue !== null) {
      if (formData.discountType === 'FIXED') {
        diskon = formData.discountValue
      } else {
        diskon = (subtotal * formData.discountValue) / 100
      }

      diskonInfo = {
        type: formData.discountType,
        value: formData.discountValue,
        duration: formData.discountDuration,
        durationUnit: formData.discountDurationUnit,
        isCustom: true,
      }
    } else if (selectedPaket.useDiscount && selectedPaket.discountType && selectedPaket.discountValue) {
      if (selectedPaket.discountType === 'FIXED') {
        diskon = selectedPaket.discountValue
      } else {
        diskon = (subtotal * selectedPaket.discountValue) / 100
      }

      diskonInfo = {
        type: selectedPaket.discountType,
        value: selectedPaket.discountValue,
        duration: selectedPaket.discountDuration,
        durationUnit: selectedPaket.discountDurationUnit,
        isCustom: false,
      }
    }
  }

  subtotal = Math.max(0, subtotal - diskon)

  const biayaInstalasiSebelumDiskon = formData.biayaInstalasi || 0
  const biayaSewaPerangkatSebelumDiskon = formData.biayaSewaPerangkat || 0
  const biayaLainnyaSebelumDiskon = formData.biayaLainnya || 0

  const biayaInstalasi =
    biayaInstalasiSebelumDiskon > 0 && formData.useDiskonBiayaInstalasi
      ? applyPercentageDiscount(biayaInstalasiSebelumDiskon, formData.biayaInstalasiDiskon)
      : biayaInstalasiSebelumDiskon

  const biayaSewaPerangkat =
    biayaSewaPerangkatSebelumDiskon > 0 && formData.useDiskonSewaPerangkat
      ? applyPercentageDiscount(biayaSewaPerangkatSebelumDiskon, formData.biayaSewaPerangkatDiskon)
      : biayaSewaPerangkatSebelumDiskon

  const biayaLainnya =
    biayaLainnyaSebelumDiskon > 0 && formData.useDiskonBiayaLainnya
      ? applyPercentageDiscount(biayaLainnyaSebelumDiskon, formData.biayaLainnyaDiskon)
      : biayaLainnyaSebelumDiskon

  const totalBiayaLainnya = biayaInstalasi + biayaSewaPerangkat + biayaLainnya

  let ppn = 0
  if (formData.usePPN && selectedPaket.usePPN && selectedPaket.ppnPercentage) {
    ppn = ((subtotal + totalBiayaLainnya) * selectedPaket.ppnPercentage) / 100
  }

  return {
    hargaPaket: selectedPaket.harga,
    diskon,
    ppn,
    subtotal,
    biayaInstalasi,
    biayaSewaPerangkat,
    biayaLainnya,
    totalBiayaLainnya,
    total: subtotal + totalBiayaLainnya + ppn,
    paket: selectedPaket,
    diskonInfo,
    prorateInfo,
    biayaInstalasiDiskon: formData.useDiskonBiayaInstalasi ? formData.biayaInstalasiDiskon : null,
    biayaInstalasiSebelumDiskon,
    biayaSewaPerangkatDiskon: formData.useDiskonSewaPerangkat ? formData.biayaSewaPerangkatDiskon : null,
    biayaSewaPerangkatSebelumDiskon,
    biayaLainnyaDiskon: formData.useDiskonBiayaLainnya ? formData.biayaLainnyaDiskon : null,
    biayaLainnyaSebelumDiskon,
  }
}

export function formatPppRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}
