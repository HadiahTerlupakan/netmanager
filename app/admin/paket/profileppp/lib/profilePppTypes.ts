export type ProfilePPP = {
  id: string
  name: string
  localAddress: string
  remoteAddress: string
  dnsServer?: string | null
  sessionTimeout?: number | null
  idleTimeout?: number | null
  poolMode?: 'MIKROTIK' | 'RADIUS' | null
  mikroTikRouterId?: string | null
  mikroTikRouter?: {
    id: string
    name: string
    ipAddress: string
  } | null
  description?: string | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: string
  ipRange?: string | null
  siteId?: string | null
  _count?: {
    hargaPaket: number
  }
}

export type MikroTikRouter = {
  id: string
  name: string
  ipAddress: string
  siteId?: string
}

export type Bandwidth = {
  id: string
  name: string
  maxLimitDownload: string
  maxLimitUpload: string
}

export type ProfilePppFormData = {
  name: string
  localAddress: string
  remoteAddress: string
  ipRangeStart: string
  ipRangeEnd: string
  dnsServer: string
  mikroTikRouterId: string
  bandwidthId: string
  poolMode: 'MIKROTIK' | 'RADIUS'
  description: string
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  siteId: string
}

export type ProfileDetail = {
  id: string
  name: string
  localAddress: string
  remoteAddress: string
  dnsServer?: string | null
  sessionTimeout?: number | null
  idleTimeout?: number | null
  mikroTikRouter?: {
    name: string
    ipAddress: string
  } | null
  description?: string | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  ipRange?: string | null
  site?: {
    name: string
  } | null
  hargaPaket: {
    id: string
    name: string
    harga: number
    bandwidth?: {
      name: string
      maxLimitDownload: string
      maxLimitUpload: string
    } | null
  }[]
}
