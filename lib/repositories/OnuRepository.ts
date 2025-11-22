import { PrismaClient, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type {
  IOnuRepository,
  OnuCreateData, 
  OnuUpdateData, 
  OnuPublic, 
  OnuFilters, 
  PaginationOptions, 
  PaginatedOnuResult 
} from './IOnuRepository'

export class OnuRepository implements IOnuRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<OnuPublic[]> {
    const onus = await this.client.onu.findMany({
      orderBy: { lastUpdate: 'desc' },
      include: {
        olt: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
    return onus
  }

  async findWithFilters(filters: OnuFilters, pagination: PaginationOptions): Promise<PaginatedOnuResult> {
    const { page, limit } = pagination
    const skip = (page - 1) * limit

    // Build where clause dynamically
    const whereConditions: Prisma.OnuWhereInput[] = []

    // Filter by OLT ID (prioritas lebih tinggi dari oltName)
    if (filters.oltId) {
      whereConditions.push({ oltId: filters.oltId })
    } else if (filters.oltName) {
      // Get OLT by name
      const olt = await this.client.olt.findFirst({
        where: { name: filters.oltName },
        select: { id: true },
      })
      if (olt) {
        whereConditions.push({ oltId: olt.id })
      } else {
        // If OLT not found, return empty result
        return {
          onus: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        }
      }
    }

    // Filter by Card (Frame) - parse gponOnu format: Frame/Slot/Port:OnuID
    if (filters.card) {
      whereConditions.push({
        gponOnu: {
          startsWith: `${filters.card}/`,
        },
      })
    }

    // Filter by Port (PON) - parse gponOnu format: Frame/Slot/Port:OnuID
    if (filters.port) {
      // We need to check the third segment (Port)
      // This is a bit tricky with Prisma, we'll need to get all and filter
      // For now, we use contains which is not perfect but works
      whereConditions.push({
        gponOnu: {
          contains: `/${filters.port}:`,
        },
      })
    }

    // Filter by ONU Type
    if (filters.type) {
      whereConditions.push({ actualType: filters.type })
    }

    // Filter by Status
    if (filters.status) {
      let statusValue = filters.status
      if (filters.status === 'online') {
        statusValue = 'Online'
      } else if (filters.status === 'dyinggasp') {
        statusValue = 'DyingGasp'
      } else if (filters.status === 'los') {
        statusValue = 'LOS'
      }
      whereConditions.push({ status: statusValue })
    }

    // Search across multiple fields
    if (filters.search) {
      whereConditions.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { pppoe: { contains: filters.search, mode: 'insensitive' } },
          { gponOnu: { contains: filters.search, mode: 'insensitive' } },
          { serialNumber: { contains: filters.search, mode: 'insensitive' } },
        ],
      })
    }

    // Combine all where conditions
    const whereClause: Prisma.OnuWhereInput = whereConditions.length > 0 
      ? { AND: whereConditions } 
      : {}

    // Get all ONUs for signal filtering (if needed)
    let allOnus: OnuPublic[] = []
    if (filters.signal) {
      // We need to fetch all matching ONUs to filter by signal
      allOnus = await this.client.onu.findMany({
        where: whereClause,
        orderBy: { lastUpdate: 'desc' },
        include: {
          olt: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      // Filter by signal quality
      allOnus = allOnus.filter((onu) => {
        const rxOlt = onu.rxOlt ? parseFloat(onu.rxOlt.replace(/[^\d.-]/g, '')) : null
        
        if (filters.signal === 'good' && rxOlt !== null && rxOlt >= -26.0) return true
        if (filters.signal === 'warning' && rxOlt !== null && rxOlt >= -28.0 && rxOlt < -26.0) return true
        if (filters.signal === 'critical' && rxOlt !== null && rxOlt < -28.0) return true
        if (filters.signal === 'other' && (rxOlt === null || onu.status === 'LOS' || onu.status === 'DyingGasp')) return true
        
        return false
      })

      // Apply pagination to filtered results
      const total = allOnus.length
      const totalPages = Math.ceil(total / limit)
      const paginatedOnus = allOnus.slice(skip, skip + limit)

      return {
        onus: paginatedOnus,
        total,
        page,
        limit,
        totalPages,
      }
    }

    // For port filtering (Frame/Slot/Port), we need to do additional filtering in memory
    // because Prisma doesn't support complex string parsing in queries
    if (filters.port && !filters.signal) {
      allOnus = await this.client.onu.findMany({
        where: whereClause,
        orderBy: { lastUpdate: 'desc' },
        include: {
          olt: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      // More precise port filtering - Format: "Frame/Slot/Port"
      const [frame, slot, portNum] = filters.port.split('/').map(Number)
      allOnus = allOnus.filter((onu) => {
        // Format: Frame/Slot/Port:OnuID
        const match = onu.gponOnu.match(/^(\d+)\/(\d+)\/(\d+):/)
        if (match) {
          const onuFrame = parseInt(match[1], 10)
          const onuSlot = parseInt(match[2], 10)
          const onuPort = parseInt(match[3], 10)
          return onuFrame === frame && onuSlot === slot && onuPort === portNum
        }
        return false
      })

      const total = allOnus.length
      const totalPages = Math.ceil(total / limit)
      const paginatedOnus = allOnus.slice(skip, skip + limit)

      return {
        onus: paginatedOnus,
        total,
        page,
        limit,
        totalPages,
      }
    }
    
    // For card filtering (Frame/Slot), we need to do additional filtering in memory
    if (filters.card && !filters.signal && !filters.port) {
      allOnus = await this.client.onu.findMany({
        where: whereClause,
        orderBy: { lastUpdate: 'desc' },
        include: {
          olt: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      // More precise card filtering - Format: "Frame/Slot"
      const [frame, slot] = filters.card.split('/').map(Number)
      allOnus = allOnus.filter((onu) => {
        // Format: Frame/Slot/Port:OnuID
        const match = onu.gponOnu.match(/^(\d+)\/(\d+)\/(\d+):/)
        if (match) {
          const onuFrame = parseInt(match[1], 10)
          const onuSlot = parseInt(match[2], 10)
          return onuFrame === frame && onuSlot === slot
        }
        return false
      })

      const total = allOnus.length
      const totalPages = Math.ceil(total / limit)
      const paginatedOnus = allOnus.slice(skip, skip + limit)

      return {
        onus: paginatedOnus,
        total,
        page,
        limit,
        totalPages,
      }
    }

    // Standard query with pagination (no signal or precise port filtering)
    const [onus, total] = await Promise.all([
      this.client.onu.findMany({
        where: whereClause,
        orderBy: { lastUpdate: 'desc' },
        skip,
        take: limit,
        include: {
          olt: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.client.onu.count({ where: whereClause }),
    ])

    const totalPages = Math.ceil(total / limit)

    return {
      onus,
      total,
      page,
      limit,
      totalPages,
    }
  }

  async findByOltId(oltId: string): Promise<OnuPublic[]> {
    const onus = await this.client.onu.findMany({
      where: { oltId },
      orderBy: { gponOnu: 'asc' },
      include: {
        olt: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
    return onus
  }

  async findByGponOnu(oltId: string, gponOnu: string): Promise<OnuPublic | null> {
    const onu = await this.client.onu.findUnique({
      where: {
        oltId_gponOnu: {
          oltId,
          gponOnu,
        },
      },
      include: {
        olt: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
    return onu
  }

  async create(data: OnuCreateData): Promise<{ id: string }> {
    const onu = await this.client.onu.create({
      data: {
        ...data,
        lastUpdate: new Date(),
      },
      select: { id: true },
    })
    return onu
  }

  async upsert(oltId: string, gponOnu: string, data: OnuCreateData): Promise<{ id: string; updated: boolean }> {
    // Cek apakah data sudah ada
    const existing = await this.client.onu.findUnique({
      where: {
        oltId_gponOnu: {
          oltId,
          gponOnu,
        },
      },
    })

    if (existing) {
      // Hanya update field yang berubah untuk optimasi
      const updateData: any = {}
      let hasChanges = false

      // Compare dan hanya update field yang berbeda
      const fieldsToCheck: (keyof OnuCreateData)[] = [
        'name', 'description', 'pppoe', 'status', 'rxOlt', 'rxOnu', 'txOlt', 'txOnu',
        'serialNumber', 'actualType', 'registerTime', 'distance', 'lastSeen',
        'registrationMode', 'softwareVersion', 'hardwareVersion', 'temperature',
        'laserBiasCurrent', 'vendorId', 'equipmentId', 'firmwareVersion',
        'macAddress', 'batteryStatus', 'opticalTransceiverType', 'lastDeregTime',
        'authMode', 'loid', 'password', 'configState', 'powerLevel', 'dyingGaspTime',
        'rxPowerStatus', 'txPowerStatus', 'rxBytes', 'txBytes', 'rxPackets', 'txPackets',
        'rxErrors', 'txErrors', 'rxDrops', 'txDrops', 'wifiEnable', 'wifiSsid',
        'wifiSecurityMode', 'wifiChannel'
      ]

      for (const field of fieldsToCheck) {
        const newValue = data[field]
        const oldValue = existing[field as keyof typeof existing]
        
        // Compare values (handle null/undefined)
        if (newValue !== undefined) {
          let isDifferent = false
          
          // Handle null comparison
          if (newValue === null && oldValue === null) {
            isDifferent = false
          } else if (newValue === null || oldValue === null) {
            isDifferent = true
          }
          // Deep comparison for dates
          else if (newValue instanceof Date && oldValue instanceof Date) {
            isDifferent = newValue.getTime() !== oldValue.getTime()
          }
          // Handle bigint comparison
          else if (typeof newValue === 'bigint' && typeof oldValue === 'bigint') {
            isDifferent = newValue !== oldValue
          }
          // Regular comparison
          else {
            isDifferent = newValue !== oldValue
          }
          
          if (isDifferent) {
            updateData[field] = newValue
            hasChanges = true
          }
        }
      }

      // Jika ada perubahan, update
      if (hasChanges) {
        updateData.lastUpdate = new Date()
        await this.client.onu.update({
          where: {
            oltId_gponOnu: {
              oltId,
              gponOnu,
            },
          },
          data: updateData,
        })
        return { id: existing.id, updated: true }
      } else {
        // Tidak ada perubahan, skip update
        return { id: existing.id, updated: false }
      }
    } else {
      // Insert baru
      const onu = await this.client.onu.create({
        data: {
          ...data,
          oltId,
          gponOnu,
          lastUpdate: new Date(),
        },
        select: { id: true },
      })
      return { id: onu.id, updated: true }
    }
  }

  async update(id: string, data: OnuUpdateData): Promise<void> {
    await this.client.onu.update({
      where: { id },
      data: {
        ...data,
        lastUpdate: data.lastUpdate || new Date(),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.onu.delete({
      where: { id },
    })
  }

  async deleteByOltId(oltId: string): Promise<void> {
    await this.client.onu.deleteMany({
      where: { oltId },
    })
  }

  async count(): Promise<number> {
    return await this.client.onu.count()
  }

  async countByOltId(oltId: string): Promise<number> {
    return await this.client.onu.count({
      where: { oltId },
    })
  }

  async countByStatus(status: string): Promise<number> {
    return await this.client.onu.count({
      where: { status },
    })
  }
}

