import { PrismaClient, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
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
        id: randomUUID(),
        updatedAt: new Date(),
        deviceId: data.deviceId,
        deviceType: data.deviceType,
        cpuUsage: data.cpuUsage ?? null,
        memoryUsage: data.memoryUsage ?? null,
        temperature: data.temperature ?? null,
        uptime: data.uptime ? BigInt(data.uptime) : null,
        rxBytes: data.rxBytes ? BigInt(data.rxBytes) : null,
        txBytes: data.txBytes ? BigInt(data.txBytes) : null,
        rxPackets: data.rxPackets ? BigInt(data.rxPackets) : null,
        txPackets: data.txPackets ? BigInt(data.txPackets) : null,
        rxDrops: data.rxDrops ? BigInt(data.rxDrops) : null,
        txDrops: data.txDrops ? BigInt(data.txDrops) : null,
        rxErrors: data.rxErrors ? BigInt(data.rxErrors) : null,
        txErrors: data.txErrors ? BigInt(data.txErrors) : null,
        interfaceStatus: (data.interfaceStatus ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        connectionCount: data.connectionCount ?? null,
        bandwidthUsage: data.bandwidthUsage ?? null,
        signalStrength: data.signalStrength ?? null,
        powerLevel: data.powerLevel ?? null,
        customMetrics: (data.customMetrics ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    })
  }

  async findById(id: string): Promise<NetworkPerformancePublic | null> {
    return await this.client.networkPerformance.findUnique({
      where: { id },
    })
  }

  async findByDeviceId(deviceId: string, deviceType: string, filters: NetworkPerformanceFilters = {}): Promise<{ data: NetworkPerformancePublic[], pagination: { page: number, limit: number, total: number, totalPages: number } }> {
    const where: Prisma.NetworkPerformanceWhereInput = {
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

    const orderBy: Prisma.NetworkPerformanceOrderByWithRelationInput = {}
    if (filters.sortBy) {
      (orderBy as Record<string, unknown>)[filters.sortBy] = filters.sortOrder || 'desc'
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

  async findMany(filters: NetworkPerformanceFilters = {}): Promise<{ data: NetworkPerformancePublic[], pagination: { page: number, limit: number, total: number, totalPages: number } }> {
    const where: Prisma.NetworkPerformanceWhereInput = {}

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

    const orderBy: Prisma.NetworkPerformanceOrderByWithRelationInput = {}
    if (filters.sortBy) {
      (orderBy as Record<string, unknown>)[filters.sortBy] = filters.sortOrder || 'desc'
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
        updatedAt: new Date(),
        ...(data.cpuUsage !== undefined ? { cpuUsage: data.cpuUsage } : {}),
        ...(data.memoryUsage !== undefined ? { memoryUsage: data.memoryUsage } : {}),
        ...(data.temperature !== undefined ? { temperature: data.temperature } : {}),
        ...(data.uptime !== undefined ? { uptime: data.uptime ? BigInt(data.uptime) : null } : {}),
        ...(data.rxBytes !== undefined ? { rxBytes: data.rxBytes ? BigInt(data.rxBytes) : null } : {}),
        ...(data.txBytes !== undefined ? { txBytes: data.txBytes ? BigInt(data.txBytes) : null } : {}),
        ...(data.rxPackets !== undefined ? { rxPackets: data.rxPackets ? BigInt(data.rxPackets) : null } : {}),
        ...(data.txPackets !== undefined ? { txPackets: data.txPackets ? BigInt(data.txPackets) : null } : {}),
        ...(data.rxDrops !== undefined ? { rxDrops: data.rxDrops ? BigInt(data.rxDrops) : null } : {}),
        ...(data.txDrops !== undefined ? { txDrops: data.txDrops ? BigInt(data.txDrops) : null } : {}),
        ...(data.rxErrors !== undefined ? { rxErrors: data.rxErrors ? BigInt(data.rxErrors) : null } : {}),
        ...(data.txErrors !== undefined ? { txErrors: data.txErrors ? BigInt(data.txErrors) : null } : {}),
        ...(data.interfaceStatus !== undefined ? { interfaceStatus: (data.interfaceStatus ?? Prisma.JsonNull) as Prisma.InputJsonValue } : {}),
        ...(data.connectionCount !== undefined ? { connectionCount: data.connectionCount } : {}),
        ...(data.bandwidthUsage !== undefined ? { bandwidthUsage: data.bandwidthUsage } : {}),
        ...(data.signalStrength !== undefined ? { signalStrength: data.signalStrength } : {}),
        ...(data.powerLevel !== undefined ? { powerLevel: data.powerLevel } : {}),
        ...(data.customMetrics !== undefined ? { customMetrics: (data.customMetrics ?? Prisma.JsonNull) as Prisma.InputJsonValue } : {}),
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
    const where: Prisma.NetworkPerformanceWhereInput = {}

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