export interface MikroTikRouterCreateData {
  name: string
  ipAddress: string
  timezone?: string
  apiPort?: number
  apiUsername: string
  apiPassword: string
  authPort?: number
  accountingPort?: number
  secretRadius: string
  isolirUrl?: string | null

  description?: string | null
  siteId?: string | null
}

export interface MikroTikRouterUpdateData {
  name?: string
  ipAddress?: string
  timezone?: string
  apiPort?: number
  apiUsername?: string
  apiPassword?: string
  authPort?: number
  accountingPort?: number
  secretRadius?: string
  isolirUrl?: string | null
  description?: string | null
  pingStatus?: string
  userOnline?: number

  lastStatusCheck?: Date | null
  siteId?: string | null
}

export interface MikroTikRouterPublic {
  id: string
  name: string
  ipAddress: string
  timezone: string
  apiPort: number
  apiUsername: string                 // Master user (untuk provisioning/hapus)
  apiPassword: string                 // Master password
  apiUsernameGenerated: string | null // Generated API user (untuk koneksi rutin)
  apiPasswordGenerated: string | null // Generated API password
  authPort: number
  accountingPort: number
  secretRadius: string
  isolirUrl: string | null
  description: string | null
  pingStatus: string
  userOnline: number
  lastStatusCheck: Date | null
  createdAt: Date

  updatedAt: Date
  siteId: string | null
}

export interface MikroTikRouterStatistics {
  total: number
  online: number
  offline: number
  totalUserOnline: number
}

export interface RouterFilters {
  search?: string
  siteId?: string
}

// Use PaginationOptions from IOnuRepository
import type { PaginationOptions } from './IOnuRepository'
export type { PaginationOptions }

export interface PaginatedRouterResult {
  routers: MikroTikRouterPublic[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface IMikroTikRouterRepository {
  findAll(): Promise<MikroTikRouterPublic[]>
  findWithFilters(filters: RouterFilters, pagination: PaginationOptions): Promise<PaginatedRouterResult>
  findById(id: string): Promise<MikroTikRouterPublic | null>
  create(data: MikroTikRouterCreateData): Promise<{ id: string }>
  update(id: string, data: MikroTikRouterUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(siteId?: string): Promise<number>
  getStatistics(siteId?: string): Promise<MikroTikRouterStatistics>
}

