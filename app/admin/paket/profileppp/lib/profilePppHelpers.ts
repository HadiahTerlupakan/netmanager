import type { ProfilePPP, ProfilePppFormData } from './profilePppTypes'

export const createInitialProfilePppFormData = (): ProfilePppFormData => ({
  name: '',
  localAddress: '',
  remoteAddress: '',
  ipRangeStart: '',
  ipRangeEnd: '',
  dnsServer: '',
  mikroTikRouterId: '',
  bandwidthId: '',
  poolMode: 'MIKROTIK',
  description: '',
  status: 'AKTIF',
  siteId: '',
})

export const buildProfilePppPayload = (
  formData: ProfilePppFormData,
  pppConnectionMode: 'RADIUS' | 'MIKROTIK_API'
) => {
  const ipRange = formData.ipRangeStart?.trim() && formData.ipRangeEnd?.trim()
    ? `${formData.ipRangeStart.trim()}-${formData.ipRangeEnd.trim()}`
    : undefined

  return {
    name: formData.name,
    localAddress: formData.localAddress,
    remoteAddress: formData.remoteAddress,
    ipRange,
    dnsServer: formData.dnsServer?.trim() || undefined,
    mikroTikRouterId: formData.mikroTikRouterId?.trim() || undefined,
    bandwidthId: formData.bandwidthId?.trim() || undefined,
    poolMode: pppConnectionMode === 'RADIUS' ? formData.poolMode : 'MIKROTIK',
    description: formData.description?.trim() || undefined,
    status: formData.status,
    siteId: formData.siteId || undefined,
  }
}

export const mapProfilePppToFormData = (
  profile: ProfilePPP,
  ipRangeStart = '',
  ipRangeEnd = ''
): ProfilePppFormData => ({
  name: profile.name,
  localAddress: profile.localAddress,
  remoteAddress: profile.remoteAddress,
  ipRangeStart,
  ipRangeEnd,
  dnsServer: profile.dnsServer || '',
  mikroTikRouterId: profile.mikroTikRouterId || '',
  bandwidthId: '',
  poolMode: profile.poolMode || 'MIKROTIK',
  description: profile.description || '',
  status: profile.status,
  siteId: profile.siteId || '',
})

export const splitIpRange = (ipRange?: string | null) => {
  if (!ipRange || ipRange.trim() === '') {
    return { ipRangeStart: '', ipRangeEnd: '' }
  }

  const parts = ipRange.split('-')
  if (parts.length === 2) {
    return {
      ipRangeStart: parts[0]?.trim() || '',
      ipRangeEnd: parts[1]?.trim() || '',
    }
  }

  return { ipRangeStart: '', ipRangeEnd: '' }
}

export const formatTimeout = (seconds?: number | null) => {
  if (!seconds) return '-'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  const parts = []
  if (hours > 0) parts.push(`${hours}j`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}d`)

  return parts.join(' ')
}
