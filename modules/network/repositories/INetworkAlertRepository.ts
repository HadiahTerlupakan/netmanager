import type { PrismaClient } from '@prisma/client'

export type { PrismaClient }

export interface NetworkAlertCreateData {
  deviceId: string
  deviceType: string
  alertType: string
  title: string
  message: string
  severity: string
  threshold?: number
  currentValue?: number
  metricName?: string
  autoResolve?: boolean
  autoResolveTime?: number
}

export interface NetworkAlertUpdateData {
  title?: string
  message?: string
  severity?: string
  status?: string
  acknowledged?: boolean
  acknowledgedBy?: string
  resolved?: boolean
  resolvedBy?: string
  autoResolve?: boolean
  autoResolveTime?: number
}

export interface NetworkAlertFilters {
  deviceId?: string
  deviceType?: 'OLT' | 'MIKROTIK' | 'ONU'
  status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED'
  severity?: 'CRITICAL' | 'WARNING' | 'INFO'
  alertType?: 'CRITICAL' | 'WARNING' | 'INFO'
  acknowledged?: boolean
  resolved?: boolean
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface NetworkAlertPublic {
  id: string
  deviceId: string
  deviceType: string
  alertType: string
  title: string
  message: string
  severity: string
  status: string
  threshold?: number | null
  currentValue?: number | null
  metricName?: string | null
  acknowledged: boolean
  acknowledgedBy?: string | null
  acknowledgedAt?: Date | null
  resolved: boolean
  resolvedBy?: string | null
  resolvedAt?: Date | null
  autoResolve: boolean
  autoResolveTime?: number | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface INetworkAlertRepository {
  create(data: NetworkAlertCreateData): Promise<NetworkAlertPublic>
  findById(id: string): Promise<NetworkAlertPublic | null>
  findMany(filters?: NetworkAlertFilters): Promise<{ data: NetworkAlertPublic[], pagination: { page: number, limit: number, total: number, totalPages: number } }>
  update(id: string, data: NetworkAlertUpdateData): Promise<void>
  acknowledge(id: string, userId: string): Promise<void>
  resolve(id: string, userId: string): Promise<void>
  delete(id: string): Promise<void>
  getActiveAlerts(deviceId?: string, deviceType?: string): Promise<NetworkAlertPublic[]>
  cleanupOldAlerts(olderThanDays?: number): Promise<{ count: number }>
  count(filters?: NetworkAlertFilters): Promise<number>
}