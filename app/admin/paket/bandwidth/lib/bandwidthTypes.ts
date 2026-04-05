export type BandwidthStatus = 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'

export type Bandwidth = {
  id: string
  name: string
  maxLimitDownload: string
  maxLimitUpload: string
  burstLimitDownload?: string | null
  burstLimitUpload?: string | null
  minLimitDownload?: string | null
  minLimitUpload?: string | null
  burstThresholdDownload?: string | null
  burstThresholdUpload?: string | null
  burstTimeDownload?: number | null
  burstTimeUpload?: number | null
  priority?: number | null
  uploadSpeed?: number | null
  downloadSpeed?: number | null
  description?: string | null
  status: BandwidthStatus
  createdAt: string
  siteId?: string | null
  _count?: {
    hargaPakets: number
  }
}

export type BandwidthUnit = 'k' | 'M' | 'G' | 'T'

export type BandwidthFormData = {
  name: string
  maxLimitDownloadValue: string
  maxLimitDownloadUnit: BandwidthUnit
  maxLimitUploadValue: string
  maxLimitUploadUnit: BandwidthUnit
  burstLimitDownloadValue: string
  burstLimitDownloadUnit: BandwidthUnit
  burstLimitUploadValue: string
  burstLimitUploadUnit: BandwidthUnit
  minLimitDownloadValue: string
  minLimitDownloadUnit: BandwidthUnit
  minLimitUploadValue: string
  minLimitUploadUnit: BandwidthUnit
  burstThresholdDownloadValue: string
  burstThresholdDownloadUnit: BandwidthUnit
  burstThresholdUploadValue: string
  burstThresholdUploadUnit: BandwidthUnit
  burstTimeDownload: number | undefined
  burstTimeUpload: number | undefined
  priority: number | undefined
  description: string
  status: BandwidthStatus
  siteId: string
}

export type BandwidthDetail = {
  id: string
  name: string
  maxLimitDownload: string
  maxLimitUpload: string
  burstLimitDownload?: string | null
  burstLimitUpload?: string | null
  minLimitDownload?: string | null
  minLimitUpload?: string | null
  burstThresholdDownload?: string | null
  burstThresholdUpload?: string | null
  burstTimeDownload?: number | null
  burstTimeUpload?: number | null
  priority?: number | null
  description?: string | null
  status: BandwidthStatus
  site?: {
    name: string
  } | null
  hargaPaket: {
    id: string
    name: string
    harga: number
    profilePPP?: {
      name: string
    } | null
  }[]
}
