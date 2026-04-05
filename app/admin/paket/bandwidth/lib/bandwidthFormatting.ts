import type { Bandwidth, BandwidthFormData, BandwidthUnit } from './bandwidthTypes'

export const createInitialBandwidthFormData = (): BandwidthFormData => ({
  name: '',
  maxLimitDownloadValue: '',
  maxLimitDownloadUnit: 'M',
  maxLimitUploadValue: '',
  maxLimitUploadUnit: 'M',
  burstLimitDownloadValue: '',
  burstLimitDownloadUnit: 'M',
  burstLimitUploadValue: '',
  burstLimitUploadUnit: 'M',
  minLimitDownloadValue: '',
  minLimitDownloadUnit: 'M',
  minLimitUploadValue: '',
  minLimitUploadUnit: 'M',
  burstThresholdDownloadValue: '',
  burstThresholdDownloadUnit: 'M',
  burstThresholdUploadValue: '',
  burstThresholdUploadUnit: 'M',
  burstTimeDownload: undefined,
  burstTimeUpload: undefined,
  priority: undefined,
  description: '',
  status: 'AKTIF',
  siteId: '',
})

export const parseMikrotikFormat = (format: string): { value: string; unit: BandwidthUnit } => {
  if (!format) return { value: '', unit: 'M' }
  const match = format.match(/^(\d+(?:\.\d+)?)([kMGT])?$/)
  if (match) {
    return {
      value: match[1] || '',
      unit: (match[2] || 'M') as BandwidthUnit,
    }
  }
  return { value: format, unit: 'M' }
}

export const formatToMikrotik = (value: string, unit: string): string => {
  if (!value) return ''
  return `${value}${unit}`
}

export const buildBandwidthPayload = (formData: BandwidthFormData) => ({
  name: formData.name,
  maxLimitDownload: formatToMikrotik(formData.maxLimitDownloadValue, formData.maxLimitDownloadUnit),
  maxLimitUpload: formatToMikrotik(formData.maxLimitUploadValue, formData.maxLimitUploadUnit),
  burstLimitDownload: formData.burstLimitDownloadValue ? formatToMikrotik(formData.burstLimitDownloadValue, formData.burstLimitDownloadUnit) : undefined,
  burstLimitUpload: formData.burstLimitUploadValue ? formatToMikrotik(formData.burstLimitUploadValue, formData.burstLimitUploadUnit) : undefined,
  minLimitDownload: formData.minLimitDownloadValue ? formatToMikrotik(formData.minLimitDownloadValue, formData.minLimitDownloadUnit) : undefined,
  minLimitUpload: formData.minLimitUploadValue ? formatToMikrotik(formData.minLimitUploadValue, formData.minLimitUploadUnit) : undefined,
  burstThresholdDownload: formData.burstThresholdDownloadValue ? formatToMikrotik(formData.burstThresholdDownloadValue, formData.burstThresholdDownloadUnit) : undefined,
  burstThresholdUpload: formData.burstThresholdUploadValue ? formatToMikrotik(formData.burstThresholdUploadValue, formData.burstThresholdUploadUnit) : undefined,
  burstTimeDownload: formData.burstTimeDownload || undefined,
  burstTimeUpload: formData.burstTimeUpload || undefined,
  priority: formData.priority || undefined,
  description: formData.description?.trim() || undefined,
  status: formData.status,
  siteId: formData.siteId || undefined,
})

export const mapBandwidthToFormData = (bandwidth: Bandwidth): BandwidthFormData => {
  const maxLimitD = parseMikrotikFormat(bandwidth.maxLimitDownload || '')
  const maxLimitU = parseMikrotikFormat(bandwidth.maxLimitUpload || '')
  const burstLimitD = parseMikrotikFormat(bandwidth.burstLimitDownload || '')
  const burstLimitU = parseMikrotikFormat(bandwidth.burstLimitUpload || '')
  const minLimitD = parseMikrotikFormat(bandwidth.minLimitDownload || '')
  const minLimitU = parseMikrotikFormat(bandwidth.minLimitUpload || '')
  const burstThresholdD = parseMikrotikFormat(bandwidth.burstThresholdDownload || '')
  const burstThresholdU = parseMikrotikFormat(bandwidth.burstThresholdUpload || '')

  return {
    name: bandwidth.name,
    maxLimitDownloadValue: maxLimitD.value,
    maxLimitDownloadUnit: maxLimitD.unit,
    maxLimitUploadValue: maxLimitU.value,
    maxLimitUploadUnit: maxLimitU.unit,
    burstLimitDownloadValue: burstLimitD.value,
    burstLimitDownloadUnit: burstLimitD.unit,
    burstLimitUploadValue: burstLimitU.value,
    burstLimitUploadUnit: burstLimitU.unit,
    minLimitDownloadValue: minLimitD.value,
    minLimitDownloadUnit: minLimitD.unit,
    minLimitUploadValue: minLimitU.value,
    minLimitUploadUnit: minLimitU.unit,
    burstThresholdDownloadValue: burstThresholdD.value,
    burstThresholdDownloadUnit: burstThresholdD.unit,
    burstThresholdUploadValue: burstThresholdU.value,
    burstThresholdUploadUnit: burstThresholdU.unit,
    burstTimeDownload: bandwidth.burstTimeDownload || undefined,
    burstTimeUpload: bandwidth.burstTimeUpload || undefined,
    priority: bandwidth.priority || undefined,
    description: bandwidth.description || '',
    status: bandwidth.status,
    siteId: bandwidth.siteId || '',
  }
}
