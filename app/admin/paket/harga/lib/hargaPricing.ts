import type { HargaFormData, HargaPaket, HargaPaketDetail } from './hargaTypes'

export const createInitialHargaFormData = (): HargaFormData => ({
  name: '',
  profilePPPId: '',
  bandwidthId: null,
  siteId: null,
  harga: 0,
  durasi: 30,
  durasiUnit: 'HARI',
  usePPN: false,
  ppnPercentage: null,
  useDiscount: false,
  discountType: 'FIXED',
  discountValue: null,
  discountDuration: null,
  discountDurationUnit: null,
  description: '',
  featured: false,
  status: 'AKTIF',
})

export const mapHargaPaketToFormData = (paket: HargaPaket): HargaFormData => ({
  name: paket.name,
  profilePPPId: paket.profilePPPId,
  bandwidthId: paket.bandwidthId || null,
  siteId: paket.siteId || null,
  harga: paket.harga,
  durasi: paket.durasi,
  durasiUnit: paket.durasiUnit || 'HARI',
  usePPN: paket.usePPN || false,
  ppnPercentage: paket.ppnPercentage || null,
  useDiscount: paket.useDiscount || false,
  discountType: paket.discountType || 'FIXED',
  discountValue: paket.discountValue || null,
  discountDuration: paket.discountDuration || null,
  discountDurationUnit: paket.discountDurationUnit || null,
  description: paket.description || '',
  featured: paket.featured,
  status: paket.status,
})

export const formatRupiah = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

export const calculateDiscountedPrice = (harga: number, discountType?: 'FIXED' | 'PERCENT' | null, discountValue?: number | null) => {
  if (!discountType || !discountValue) {
    return harga
  }

  return discountType === 'FIXED'
    ? Math.max(0, harga - discountValue)
    : Math.round(harga * (1 - discountValue / 100))
}

export const calculateHargaListDisplay = (item: HargaPaket) => {
  const discountedPrice = item.useDiscount && item.discountType && item.discountValue
    ? calculateDiscountedPrice(item.harga, item.discountType, item.discountValue)
    : null

  const priceWithPpn = item.usePPN && item.ppnPercentage
    ? Math.round((discountedPrice ?? item.harga) * (1 + item.ppnPercentage / 100))
    : null

  return {
    discountedPrice,
    priceWithPpn,
  }
}

export const calculateHargaDetailTotal = (paket: HargaPaketDetail) => {
  let price = paket.harga

  if (paket.useDiscount && paket.discountType && paket.discountValue) {
    price = calculateDiscountedPrice(price, paket.discountType, paket.discountValue)
  }

  if (paket.usePPN && paket.ppnPercentage) {
    price = Math.round(price * (1 + paket.ppnPercentage / 100))
  }

  return price
}
