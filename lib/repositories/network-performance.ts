import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

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

export class NetworkPerformanceRepository {
  async create(data: {
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
    interfaceStatus?: unknown
    connectionCount?: number
    bandwidthUsage?: number
    signalStrength?: number
    powerLevel?: string
    customMetrics?: unknown
  }) {
    return await prisma.networkPerformance.create({
      data: {
        id: randomUUID(),
        ...data,
        interfaceStatus: data.interfaceStatus as Prisma.InputJsonValue,
        customMetrics: data.customMetrics as Prisma.InputJsonValue,
        uptime: data.uptime ? BigInt(data.uptime) : null,
        rxBytes: data.rxBytes ? BigInt(data.rxBytes) : null,
        txBytes: data.txBytes ? BigInt(data.txBytes) : null,
        rxPackets: data.rxPackets ? BigInt(data.rxPackets) : null,
        txPackets: data.txPackets ? BigInt(data.txPackets) : null,
        rxDrops: data.rxDrops ? BigInt(data.rxDrops) : null,
        txDrops: data.txDrops ? BigInt(data.txDrops) : null,
        rxErrors: data.rxErrors ? BigInt(data.rxErrors) : null,
        txErrors: data.txErrors ? BigInt(data.txErrors) : null,
        updatedAt: new Date(),
      },
    })
  }

  async findById(id: string) {
    return await prisma.networkPerformance.findUnique({
      where: { id },
    })
  }

  async findByDeviceId(deviceId: string, deviceType: string, filters: NetworkPerformanceFilters = {}) {
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
      (orderBy as Record<string, string>)[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.timestamp = 'desc'
    }

    const [data, total] = await Promise.all([
      prisma.networkPerformance.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.networkPerformance.count({ where }),
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

  async findMany(filters: NetworkPerformanceFilters = {}) {
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
      (orderBy as Record<string, string>)[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.timestamp = 'desc'
    }

    const [data, total] = await Promise.all([
      prisma.networkPerformance.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.networkPerformance.count({ where }),
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

  async delete(id: string) {
    return await prisma.networkPerformance.delete({
      where: { id },
    })
  }

  async deleteByDeviceId(deviceId: string, deviceType: string, olderThanDays: number = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    return await prisma.networkPerformance.deleteMany({
      where: {
        deviceId,
        deviceType,
        timestamp: {
          lt: cutoffDate,
        },
      },
    })
  }
}

export class NetworkAlertRepository {
  async create(data: {
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
  }) {
    return await prisma.networkAlerts.create({
      data: {
        id: randomUUID(),
        ...data,
        alertType: data.alertType as 'CRITICAL' | 'WARNING' | 'INFO',
        severity: data.severity as 'CRITICAL' | 'WARNING' | 'INFO',
        autoResolve: data.autoResolve || false,
        updatedAt: new Date(),
      },
    })
  }

  async findById(id: string) {
    return await prisma.networkAlerts.findUnique({
      where: { id },
    })
  }

  async findMany(filters: NetworkAlertFilters = {}) {
    const where: Prisma.NetworkAlertsWhereInput = {}

    if (filters.deviceId) where.deviceId = filters.deviceId
    if (filters.deviceType) where.deviceType = filters.deviceType
    if (filters.status) where.status = filters.status
    if (filters.severity) where.severity = filters.severity
    if (filters.alertType) where.alertType = filters.alertType
    if (filters.acknowledged !== undefined) where.acknowledged = filters.acknowledged
    if (filters.resolved !== undefined) where.resolved = filters.resolved
    where.isActive = true

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const orderBy: Prisma.NetworkAlertsOrderByWithRelationInput = {}
    if (filters.sortBy) {
      (orderBy as Record<string, string>)[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.createdAt = 'desc'
    }

    const [data, total] = await Promise.all([
      prisma.networkAlerts.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.networkAlerts.count({ where }),
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

  async update(id: string, data: {
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
  }) {
    const updateData: Prisma.NetworkAlertsUpdateInput = {
      ...data,
      severity: data.severity as 'CRITICAL' | 'WARNING' | 'INFO' | undefined,
      status: data.status as 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED' | undefined,
    }

    if (data.acknowledged && !data.acknowledgedBy) {
      updateData.acknowledgedAt = new Date()
    }

    if (data.resolved && !data.resolvedBy) {
      updateData.resolvedAt = new Date()
    }

    return await prisma.networkAlerts.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    })
  }

  async acknowledge(id: string, userId: string) {
    return await prisma.networkAlerts.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    })
  }

  async resolve(id: string, userId: string) {
    return await prisma.networkAlerts.update({
      where: { id },
      data: {
        resolved: true,
        resolvedBy: userId,
        resolvedAt: new Date(),
      },
    })
  }

  async delete(id: string) {
    return await prisma.networkAlerts.delete({
      where: { id },
    })
  }

  async getActiveAlerts(deviceId?: string, deviceType?: string) {
    const where: Prisma.NetworkAlertsWhereInput = {
      status: 'ACTIVE',
      isActive: true,
    }

    if (deviceId) where.deviceId = deviceId
    if (deviceType) where.deviceType = deviceType

    return await prisma.networkAlerts.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async cleanupOldAlerts(olderThanDays: number = 90) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    return await prisma.networkAlerts.updateMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        status: {
          in: ['RESOLVED'],
        },
      },
      data: {
        isActive: false,
      },
    })
  }
}

export function getNetworkPerformanceRepository() {
  return new NetworkPerformanceRepository()
}

export function getNetworkAlertRepository() {
  return new NetworkAlertRepository()
}