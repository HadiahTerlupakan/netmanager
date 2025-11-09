export interface OLTCreateData {
  name: string
  ipAddress: string
  type: string
  version?: string | null
  temperature?: number | null
  connectedDevices?: number
  model?: string | null
  uptime?: string | null
  syncStatus?: string
  syncDate?: Date | null
  telnetConnected?: boolean
  snmpConnected?: boolean
  snmpCommunityWrite?: string
  snmpVersion?: string
  snmpPort?: number
  telnetUsername?: string
  telnetPassword: string
  telnetPort?: number
}

export interface OLTUpdateData {
  name?: string
  ipAddress?: string
  type?: string
  version?: string | null
  temperature?: number | null
  connectedDevices?: number
  model?: string | null
  uptime?: string | null
  syncStatus?: string
  syncDate?: Date | null
  telnetConnected?: boolean
  snmpConnected?: boolean
  snmpCommunityWrite?: string
  snmpVersion?: string
  snmpPort?: number
  telnetUsername?: string
  telnetPassword?: string
  telnetPort?: number
  onuLastSync?: Date | null
  onuSyncEnabled?: boolean
}

export interface OLTPublic {
  id: string
  name: string
  ipAddress: string
  type: string
  version: string | null
  temperature: number | null
  connectedDevices: number
  model: string | null
  uptime: string | null
  syncStatus: string
  syncDate: Date | null
  telnetConnected: boolean
  snmpConnected: boolean
  snmpCommunityWrite: string
  snmpVersion: string
  snmpPort: number
  telnetUsername: string
  telnetPassword: string
  telnetPort: number
  onuLastSync: Date | null
  onuSyncEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IOLTRepository {
  findAll(): Promise<OLTPublic[]>
  findById(id: string): Promise<OLTPublic | null>
  create(data: OLTCreateData): Promise<{ id: string }>
  update(id: string, data: OLTUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}

