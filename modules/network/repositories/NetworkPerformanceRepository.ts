import { PrismaClient } from '@prisma/client'
import type { 
  INetworkPerformanceRepository, 
  NetworkPerformanceCreateData, 
  NetworkPerformanceUpdateData, 
  NetworkPerformanceFilters,
  NetworkPerformancePublic 
} from './INetworkPerformanceRepository'
import { prisma } from '@/lib/prisma'

export class NetworkPerformanceRepository implements INetworkPerformanceRepository {
  constructor(private client: PrismaClient = prisma) {}

  async create(data: NetworkPerformanceCreateData): Promise<NetworkPerformancePublic> {
    return await this.client.networkPerformance.create({
      data: {
        deviceId: data.deviceId,
        deviceType: data.deviceType,
        cpuUsage: data.cpuUsage,
        memoryUsage: data.memoryUsage,
        temperature: data.temperature,
        uptime: data.uptime ? BigInt(data.uptime) : undefined,
        rxBytes: data.rxBytes ? BigInt(data.rxBytes) : undefined,
        txBytes: data.txBytes ? BigInt(data.txBytes) : undefined,
        rxPackets: data.rxPackets ? BigInt(data.rxPackets) : undefined,
        txPackets: data.txPackets ? BigInt(data.txPackets) : undefined,
        rxDrops: data.rxDrops ? BigInt(data.rxDrops) : undefined,
        txDrops: data.txDrops ? BigInt(data.txDrops) : undefined,
        rxErrors: data.rxErrors ? BigInt(data.rxErrors) : undefined,
        txErrors: data.txErrors ? BigInt(data.txErrors) : undefined,
        interfaceStatus: data.interfaceStatus,
        connectionCount: data.connectionCount,
        bandwidthUsage: data.bandwidthUsage,
        signalStrength: data.signalStrength,
        powerLevel: data.powerLevel,
        customMetrics: data.customMetrics,
      },
    })
  }

  async findById(id: string): Promise<NetworkPerformancePublic | null> {
    return await this.client.networkPerformance.findUnique({
      where: { id },
    })
  }

  async findByDeviceId(deviceId: string, deviceType: string, filters: NetworkPerformanceFilters = {}): Promise<{ data: NetworkPerformancePublic[], pagination: any }> {
    const where: any = {
      deviceId,
      deviceType,
    }

    if (filters.startDate || filters.endDate) {
      where.timestamp = {}
      if (filters.startDate) where.timestamp.gte = filters.startDate
      if (filters.endDate) where.timestamp.lte = filters.endDate
    }

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const orderBy: any = {}
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.timestamp = 'desc'
    }

    const [data, total] = await Promise.all([
      this.client.networkPerformance.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.client.networkPerformance.count({ where }),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findMany(filters: NetworkPerformanceFilters = {}): Promise<{ data: NetworkPerformancePublic[], pagination: any }> {
    const where: any = {}

    if (filters.deviceId) where.deviceId = filters.deviceId
    if (filters.deviceType) where.deviceType = filters.deviceType

    if (filters.startDate || filters.endDate) {
      where.timestamp = {}
      if (filters.startDate) where.timestamp.gte = filters.startDate
      if (filters.endDate) where.timestamp.lte = filters.endDate
    }

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const orderBy: any = {}
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.timestamp = 'desc'
    }

    const [data, total] = await Promise.all([
      this.client.networkPerformance.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.client.networkPerformance.count({ where }),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async update(id: string, data: NetworkPerformanceUpdateData): Promise<void> {
    await this.client.networkPerformance.update({
      where: { id },
      data: {
        cpuUsage: data.cpuUsage,
        memoryUsage: data.memoryUsage,
        temperature: data.temperature,
        uptime: data.uptime ? BigInt(data.uptime) : undefined,
        rxBytes: data.rxBytes ? BigInt(data.rxBytes) : undefined,
        txBytes: data.txBytes ? BigInt(data.txBytes) : undefined,
        rxPackets: data.rxPackets ? BigInt(data.rxPackets) : undefined,
        txPackets: data.txPackets ? BigInt(data.txPackets) : undefined,
        rxDrops: data.rxDrops ? BigInt(data.rxDrops) : undefined,
        txDrops: data.txDrops ? BigInt(data.txDrops) : undefined,
        rxErrors: data.rxErrors ? BigInt(data.rxErrors) : undefined,
        txErrors: data.txErrors ? BigInt(data.txErrors) : undefined,
        interfaceStatus: data.interfaceStatus,
        connectionCount: data.connectionCount,
        bandwidthUsage: data.bandwidthUsage,
        signalStrength: data.signalStrength,
        powerLevel: data.powerLevel,
        customMetrics: data.customMetrics,
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.networkPerformance.delete({
      where: { id },
    })
  }

  async deleteByDeviceId(deviceId: string, deviceType: string, olderThanDays: number = 30): Promise<{ count: number }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const result = await this.client.networkPerformance.deleteMany({
      where: {
        deviceId,
        deviceType,
        timestamp: {
          lt: cutoffDate,
        },
      },
    })

    return { count: result.count }
  }

  async count(filters: NetworkPerformanceFilters = {}): Promise<number> {
    const where: any = {}

    if (filters.deviceId) where.deviceId = filters.deviceId
    if (filters.deviceType) where.deviceType = filters.deviceType

    if (filters.startDate || filters.endDate) {
      where.timestamp = {}
      if (filters.startDate) where.timestamp.gte = filters.startDate
      if (filters.endDate) where.timestamp.lte = filters.endDate
    }

    return await this.client.networkPerformance.count({ where })
  }
}