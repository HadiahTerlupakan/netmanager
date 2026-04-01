import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { Attendance } from '../../domain/entities/Attendance'
import type {
  AttendanceRepositoryInterface,
  AttendanceFindManyParams,
  AttendanceStatsResult,
  DailyStatsResult,
} from '../../domain/repositories/AttendanceRepository'
import { AttendanceMapper } from '../mappers/AttendanceMapper'

/**
 * Prisma implementation of AttendanceRepositoryInterface.
 *
 * This is the ONLY file in the infrastructure layer that knows
 * about Prisma queries and database access patterns.
 */
export class PrismaAttendanceRepository implements AttendanceRepositoryInterface {
  async findById(id: string, tenantId?: string): Promise<Attendance | null> {
    const record = await prisma.attendance.findFirst({
      where: { id, ...(tenantId && { tenantId }) },
    })
    return record ? AttendanceMapper.toDomain(record) : null
  }

  async findActiveByUserId(userId: string, tenantId?: string): Promise<Attendance | null> {
    const record = await prisma.attendance.findFirst({
      where: {
        userId,
        checkOut: null,
        ...(tenantId && { tenantId }),
      },
      orderBy: { checkIn: 'desc' },
    })
    return record ? AttendanceMapper.toDomain(record) : null
  }

  async findByUserIdAndDate(userId: string, date: Date, tenantId?: string): Promise<Attendance | null> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const record = await prisma.attendance.findFirst({
      where: {
        userId,
        checkIn: { gte: startOfDay, lte: endOfDay },
        ...(tenantId && { tenantId }),
      },
      orderBy: { checkIn: 'desc' },
    })
    return record ? AttendanceMapper.toDomain(record) : null
  }

  async findMany(params: AttendanceFindManyParams): Promise<{ data: Attendance[]; total: number }> {
    const { userId, tenantId, startDate, endDate, status, page = 1, limit = 20 } = params

    const where: Prisma.AttendanceWhereInput = {
      ...(userId && { userId }),
      ...(tenantId && { tenantId }),
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            checkIn: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: { checkIn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ])

    return {
      data: AttendanceMapper.toDomainList(records),
      total,
    }
  }

  async count(params: Omit<AttendanceFindManyParams, 'page' | 'limit'>): Promise<number> {
    const { userId, tenantId, startDate, endDate, status } = params
    return prisma.attendance.count({
      where: {
        ...(userId && { userId }),
        ...(tenantId && { tenantId }),
        ...(status && { status }),
        ...(startDate || endDate
          ? {
              checkIn: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate }),
              },
            }
          : {}),
      },
    })
  }

  async save(attendance: Attendance): Promise<Attendance> {
    const data = AttendanceMapper.toPrismaCreate(attendance)
    const created = await prisma.attendance.create({ data })
    return AttendanceMapper.toDomain(created)
  }

  async update(attendance: Attendance): Promise<Attendance> {
    const data = AttendanceMapper.toPrismaUpdate(attendance)
    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data,
    })
    return AttendanceMapper.toDomain(updated)
  }

  async delete(id: string, tenantId?: string): Promise<void> {
    await prisma.attendance.deleteMany({
      where: { id, ...(tenantId && { tenantId }) },
    })
  }

  async getStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    deptId?: string,
    tenantId?: string,
  ): Promise<AttendanceStatsResult[]> {
    // Delegate to raw SQL for performance (same pattern as existing repository)
    const tenantFilter = tenantId
      ? Prisma.sql`AND a."tenantId" = ${tenantId}`
      : Prisma.empty

    const result = await prisma.$queryRaw<{ status: string; count: bigint }[]>`
      SELECT a.status::text as status, COUNT(*)::bigint as count
      FROM "Attendance" a
      WHERE a."checkIn" >= ${startDate}
        AND a."checkIn" <= ${endDate}
        ${tenantFilter}
      GROUP BY a.status
    `

    return result.map((r) => ({
      status: r.status,
      count: Number(r.count),
    }))
  }

  async getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    deptId?: string,
    tenantId?: string,
  ): Promise<DailyStatsResult[]> {
    const tenantFilter = tenantId
      ? Prisma.sql`AND a."tenantId" = ${tenantId}`
      : Prisma.empty

    const result = await prisma.$queryRaw<{
      date: string
      status: string
      count: bigint
    }[]>`
      SELECT
        to_char(a."checkIn", 'YYYY-MM-DD') as date,
        a.status::text as status,
        COUNT(*)::bigint as count
      FROM "Attendance" a
      WHERE a."checkIn" >= ${startDate}
        AND a."checkIn" <= ${endDate}
        ${tenantFilter}
      GROUP BY to_char(a."checkIn", 'YYYY-MM-DD'), a.status
      ORDER BY date
    `

    // Group by date
    const dailyMap = new Map<string, DailyStatsResult>()
    for (const row of result) {
      if (!dailyMap.has(row.date)) {
        dailyMap.set(row.date, {
          date: row.date,
          present: 0,
          late: 0,
          absent: 0,
          onLeave: 0,
          dayOff: 0,
          total: 0,
        })
      }
      const day = dailyMap.get(row.date)!
      const count = Number(row.count)
      day.total += count

      switch (row.status) {
        case 'ON_TIME':
          day.present += count
          break
        case 'LATE':
          day.late += count
          break
        case 'ABSENT':
        case 'ALPHA':
          day.absent += count
          break
        case 'SICK':
        case 'PERMIT':
          day.onLeave += count
          break
        case 'DAY_OFF':
          day.dayOff += count
          break
      }
    }

    return Array.from(dailyMap.values())
  }
}
