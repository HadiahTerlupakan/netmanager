import { prisma } from '@/lib/prisma'

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
    interfaceStatus?: any
    connectionCount?: number
    bandwidthUsage?: number
    signalStrength?: number
    powerLevel?: string
    customMetrics?: any
  }) {
    return await prisma.networkPerformance.create({
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

  async findById(id: string) {
    return await prisma.networkPerformance.findUnique({
      where: { id },
    })
  }

  async findByDeviceId(deviceId: string, deviceType: string, filters: NetworkPerformanceFilters = {}) {
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
    return await prisma.networkAlert.create({
      data: {
        deviceId: data.deviceId,
        deviceType: data.deviceType,
        alertType: data.alertType as any,
        title: data.title,
        message: data.message,
        severity: data.severity as any,
        threshold: data.threshold,
        currentValue: data.currentValue,
        metricName: data.metricName,
        autoResolve: data.autoResolve || false,
        autoResolveTime: data.autoResolveTime,
      },
    })
  }

  async findById(id: string) {
    return await prisma.networkAlert.findUnique({
      where: { id },
    })
  }

  async findMany(filters: NetworkAlertFilters = {}) {
    const where: any = {}

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

    const orderBy: any = {}
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.createdAt = 'desc'
    }

    const [data, total] = await Promise.all([
      prisma.networkAlert.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.networkAlert.count({ where }),
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
    const updateData: any = { ...data }

    if (data.acknowledged && !data.acknowledgedBy) {
      updateData.acknowledgedAt = new Date()
    }

    if (data.resolved && !data.resolvedBy) {
      updateData.resolvedAt = new Date()
    }

    if (data.severity) updateData.severity = data.severity as any
    if (data.status) updateData.status = data.status as any

    return await prisma.networkAlert.update({
      where: { id },
      data: updateData,
    })
  }

  async acknowledge(id: string, userId: string) {
    return await prisma.networkAlert.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    })
  }

  async resolve(id: string, userId: string) {
    return await prisma.networkAlert.update({
      where: { id },
      data: {
        resolved: true,
        resolvedBy: userId,
        resolvedAt: new Date(),
      },
    })
  }

  async delete(id: string) {
    return await prisma.networkAlert.delete({
      where: { id },
    })
  }

  async getActiveAlerts(deviceId?: string, deviceType?: string) {
    const where: any = {
      status: 'ACTIVE',
      isActive: true,
    }

    if (deviceId) where.deviceId = deviceId
    if (deviceType) where.deviceType = deviceType

    return await prisma.networkAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async cleanupOldAlerts(olderThanDays: number = 90) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    return await prisma.networkAlert.updateMany({
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