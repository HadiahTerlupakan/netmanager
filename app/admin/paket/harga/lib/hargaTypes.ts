export type ProfilePPP = {
  id: string
  name: string
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
}

export type Site = {
  id: string
  name: string
  code: string
}

export type Bandwidth = {
  id: string
  name: string
  maxLimitDownload: string
  maxLimitUpload: string
}

export type DurationUnit = 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
export type DiscountType = 'FIXED' | 'PERCENT'
export type HargaStatus = 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'

export type HargaPaket = {
  id: string
  name: string
  bandwidthId?: string | null
  bandwidth?: {
    id: string
    name: string
    maxLimitDownload: string
    maxLimitUpload: string
  } | null
  profilePPPId: string
  profilePPP: ProfilePPP
  siteId?: string | null
  site?: Site | null
  harga: number
  durasi: number
  durasiUnit: DurationUnit
  usePPN: boolean
  ppnPercentage?: number | null
  useDiscount: boolean
  discountType?: DiscountType | null
  discountValue?: number | null
  discountDuration?: number | null
  discountDurationUnit?: DurationUnit | null
  description?: string | null
  featured: boolean
  status: HargaStatus
  createdAt: string
}

export type HargaFormData = {
  name: string
  profilePPPId: string
  bandwidthId: string | null
  siteId: string | null
  harga: number
  durasi: number
  durasiUnit: DurationUnit
  usePPN: boolean
  ppnPercentage: number | null
  useDiscount: boolean
  discountType: DiscountType | null
  discountValue: number | null
  discountDuration: number | null
  discountDurationUnit: DurationUnit | null
  description: string
  featured: boolean
  status: HargaStatus
}

export type HargaPaketDetail = {
  id: string
  name: string
  harga: number
  durasi: number
  durasiUnit: DurationUnit
  usePPN: boolean
  ppnPercentage?: number | null
  useDiscount: boolean
  discountType?: DiscountType | null
  discountValue?: number | null
  discountDuration?: number | null
  discountDurationUnit?: DurationUnit | null
  description?: string | null
  featured: boolean
  status: HargaStatus
  site?: {
    name: string
    code: string
  } | null
  profilePPP: {
    name: string
    mikroTikRouter?: {
      name: string
      ipAddress: string
    } | null
  }
  bandwidth?: {
    name: string
    maxLimitDownload: string
    maxLimitUpload: string
  } | null
}
