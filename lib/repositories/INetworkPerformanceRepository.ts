import { PrismaClient } from '@prisma/client'

export interface NetworkPerformanceCreateData {
  deviceId: string
  deviceType: string
  cpuUsage?: number
  memoryUsage?: number
  temperature?: number
  uptime?: number
  rxBytes?: number
  txBytes?: number
  rxPackets?: number
  txPackets?: number
  rxDrops?: number
  txDrops?: number
  rxErrors?: number
  txErrors?: number
  interfaceStatus?: any
  connectionCount?: number
  bandwidthUsage?: number
  signalStrength?: number
  powerLevel?: string
  customMetrics?: any
}

export interface NetworkPerformanceUpdateData {
  cpuUsage?: number
  memoryUsage?: number
  temperature?: number
  uptime?: number
  rxBytes?: number
  txBytes?: number
  rxPackets?: number
  txPackets?: number
  rxDrops?: number
  txDrops?: number
  rxErrors?: number
  txErrors?: number
  interfaceStatus?: any
  connectionCount?: number
  bandwidthUsage?: number
  signalStrength?: number
  powerLevel?: string
  customMetrics?: any
}

export interface NetworkPerformanceFilters {
  deviceId?: string
  deviceType?: 'OLT' | 'MIKROTIK' | 'ONU'
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface NetworkPerformancePublic {
  id: string
  deviceId: string
  deviceType: string
  timestamp: Date
  cpuUsage?: number | null
  memoryUsage?: number | null
  temperature?: number | null
  uptime?: bigint | null
  rxBytes?: bigint | null
  txBytes?: bigint | null
  rxPackets?: bigint | null
  txPackets?: bigint | null
  rxDrops?: bigint | null
  txDrops?: bigint | null
  rxErrors?: bigint | null
  txErrors?: bigint | null
  interfaceStatus?: any | null
  connectionCount?: number | null
  bandwidthUsage?: number | null
  signalStrength?: number | null
  powerLevel?: string | null
  customMetrics?: any | null
  createdAt: Date
  updatedAt: Date
}

export interface INetworkPerformanceRepository {
  create(data: NetworkPerformanceCreateData): Promise<NetworkPerformancePublic>
  findById(id: string): Promise<NetworkPerformancePublic | null>
  findByDeviceId(deviceId: string, deviceType: string, filters?: NetworkPerformanceFilters): Promise<{ data: NetworkPerformancePublic[], pagination: any }>
  findMany(filters?: NetworkPerformanceFilters): Promise<{ data: NetworkPerformancePublic[], pagination: any }>
  update(id: string, data: NetworkPerformanceUpdateData): Promise<void>
  delete(id: string): Promise<void>
  deleteByDeviceId(deviceId: string, deviceType: string, olderThanDays?: number): Promise<{ count: number }>
  count(filters?: NetworkPerformanceFilters): Promise<number>
}