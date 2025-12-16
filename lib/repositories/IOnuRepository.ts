export interface OnuPublic {
  id: string
  oltId: string
  olt?: {
    id: string
    name: string
  }
  name: string
  description: string | null
  pppoe: string | null
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  txOlt: string | null
  txOnu: string | null
  serialNumber: string | null
  actualType: string | null
  registerTime: Date | null
  distance: number | null
  lastSeen: Date | null
  registrationMode: string | null
  softwareVersion: string | null
  hardwareVersion: string | null
  temperature: number | null
  laserBiasCurrent: number | null
  // New fields from ZTE-AN-PON-MIB
  vendorId: string | null
  equipmentId: string | null
  firmwareVersion: string | null
  macAddress: string | null
  batteryStatus: string | null
  opticalTransceiverType: string | null
  lastDeregTime: Date | null
  authMode: string | null
  loid: string | null
  password: string | null
  configState: string | null
  powerLevel: string | null
  dyingGaspTime: Date | null
  rxPowerStatus: string | null
  txPowerStatus: string | null
  // Performance Statistics
  rxBytes: bigint | null
  txBytes: bigint | null
  rxPackets: bigint | null
  txPackets: bigint | null
  rxErrors: bigint | null
  txErrors: bigint | null
  rxDrops: bigint | null
  txDrops: bigint | null
  // WiFi Configuration
  wifiEnable: boolean | null
  wifiSsid: string | null
  wifiSecurityMode: string | null
  wifiChannel: number | null
  // SNMP OID fields
  statusOid: string | null
  rxOltOid: string | null
  rxOnuOid: string | null
  nameOid: string | null
  descOid: string | null
  compositeIndex: number | null
  lastUpdate: Date
  createdAt: Date
  updatedAt: Date
}

export interface OnuCreateData {
  oltId: string
  name: string
  description?: string | null
  pppoe?: string | null
  gponOnu: string
  status: string
  rxOlt?: string | null
  rxOnu?: string | null
  txOlt?: string | null
  txOnu?: string | null
  serialNumber?: string | null
  actualType?: string | null
  registerTime?: Date | null
  distance?: number | null
  lastSeen?: Date | null
  registrationMode?: string | null
  softwareVersion?: string | null
  hardwareVersion?: string | null
  temperature?: number | null
  laserBiasCurrent?: number | null
  // New fields from ZTE-AN-PON-MIB
  vendorId?: string | null
  equipmentId?: string | null
  firmwareVersion?: string | null
  macAddress?: string | null
  batteryStatus?: string | null
  opticalTransceiverType?: string | null
  lastDeregTime?: Date | null
  authMode?: string | null
  loid?: string | null
  password?: string | null
  configState?: string | null
  powerLevel?: string | null
  dyingGaspTime?: Date | null
  rxPowerStatus?: string | null
  txPowerStatus?: string | null
  // Performance Statistics
  rxBytes?: bigint | null
  txBytes?: bigint | null
  rxPackets?: bigint | null
  txPackets?: bigint | null
  rxErrors?: bigint | null
  txErrors?: bigint | null
  rxDrops?: bigint | null
  txDrops?: bigint | null
  // WiFi Configuration
  wifiEnable?: boolean | null
  wifiSsid?: string | null
  wifiSecurityMode?: string | null
  wifiChannel?: number | null
  // SNMP OID fields - untuk fast SNMP GET
  statusOid?: string | null
  rxOltOid?: string | null
  rxOnuOid?: string | null
  nameOid?: string | null
  descOid?: string | null
  compositeIndex?: number | null
}

export interface OnuUpdateData {
  name?: string
  description?: string | null
  pppoe?: string | null
  status?: string
  rxOlt?: string | null
  rxOnu?: string | null
  txOlt?: string | null
  txOnu?: string | null
  serialNumber?: string | null
  actualType?: string | null
  registerTime?: Date | null
  distance?: number | null
  lastSeen?: Date | null
  registrationMode?: string | null
  softwareVersion?: string | null
  hardwareVersion?: string | null
  temperature?: number | null
  laserBiasCurrent?: number | null
  // New fields from ZTE-AN-PON-MIB
  vendorId?: string | null
  equipmentId?: string | null
  firmwareVersion?: string | null
  macAddress?: string | null
  batteryStatus?: string | null
  opticalTransceiverType?: string | null
  lastDeregTime?: Date | null
  authMode?: string | null
  loid?: string | null
  password?: string | null
  configState?: string | null
  powerLevel?: string | null
  dyingGaspTime?: Date | null
  rxPowerStatus?: string | null
  txPowerStatus?: string | null
  // Performance Statistics
  rxBytes?: bigint | null
  txBytes?: bigint | null
  rxPackets?: bigint | null
  txPackets?: bigint | null
  rxErrors?: bigint | null
  txErrors?: bigint | null
  rxDrops?: bigint | null
  txDrops?: bigint | null
  // WiFi Configuration
  wifiEnable?: boolean | null
  wifiSsid?: string | null
  wifiSecurityMode?: string | null
  wifiChannel?: number | null
  lastUpdate?: Date
}

export interface OnuFilters {
  oltId?: string // Filter by OLT ID
  oltName?: string
  card?: string // Format: "Frame/Slot"
  port?: string // Format: "Frame/Slot/Port"
  type?: string
  status?: string
  signal?: string
  search?: string
}

export interface PaginationOptions {
  page: number
  limit: number
}

export interface PaginatedOnuResult {
  onus: OnuPublic[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface OnuSummaryStats {
  total: number
  online: number
  offline: number
  los: number
  dyingGasp: number
  uncfg: number
  disabled: number
}

export interface IOnuRepository {
  findAll(): Promise<OnuPublic[]>
  findByOltId(oltId: string): Promise<OnuPublic[]>
  findByGponOnu(oltId: string, gponOnu: string): Promise<OnuPublic | null>
  findWithFilters(filters: OnuFilters, pagination: PaginationOptions): Promise<PaginatedOnuResult>
  create(data: OnuCreateData): Promise<{ id: string }>
  upsert(oltId: string, gponOnu: string, data: OnuCreateData): Promise<{ id: string; updated: boolean }>
  update(id: string, data: OnuUpdateData): Promise<void>
  delete(id: string): Promise<void>
  deleteByOltId(oltId: string): Promise<void>
  count(): Promise<number>
  countByOltId(oltId: string): Promise<number>
  countByStatus(status: string): Promise<number>
  getSummaryStats(oltId?: string): Promise<OnuSummaryStats>

  // New optimized methods with caching
  findPaginatedOptimized(params: {
    oltId?: string
    page: number
    limit: number
    status?: string
    search?: string
    useCache?: boolean
  }): Promise<PaginatedOnuResult>

  findByOltIdCached(oltId: string, useCache?: boolean): Promise<OnuPublic[]>
  invalidateCache(oltId?: string): Promise<void>
}

