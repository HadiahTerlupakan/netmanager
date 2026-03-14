import { prisma } from '@/lib/prisma'
import { type IOvertimeRepository } from './IOvertimeRepository'
import { Prisma } from '@prisma/client'
import type { Overtime, OvertimeStatus } from '@prisma/client'
import { randomUUID } from 'crypto'
import { getTenantIdFromContext } from '@/lib/tenant-context'

export class OvertimeRepository implements IOvertimeRepository {
    async findById(id: string): Promise<Overtime | null> {
        return prisma.overtime.findUnique({
            where: { id },
            include: {
                user: true,
                attendance: true,
            },
        })
    }

    async findAll(filters?: {
        userId?: string
        status?: OvertimeStatus
        startDate?: Date
        endDate?: Date
        siteId?: string
        departmentId?: string
        holidayType?: string
        skip?: number
        take?: number
    }): Promise<Overtime[]> {
        const where: Prisma.OvertimeWhereInput = {}

        if (filters?.userId) where.userId = filters.userId
        if (filters?.status) where.status = filters.status
        if (filters?.startDate && filters?.endDate) {
            where.createdAt = {
                gte: filters.startDate,
                lte: filters.endDate,
            }
        }

        if (filters?.siteId || filters?.departmentId) {
            where.user = {
                ...(filters.siteId && { siteId: filters.siteId }),
                ...(filters.departmentId && { departmentId: filters.departmentId })
            }
        }

        // Holiday Filters
        if (filters?.holidayType) {
            switch (filters.holidayType) {
                case 'REGULAR':
                    where.isHolidayOvertime = false
                    break
                case 'NATIONAL':
                    where.isNationalHoliday = true
                    break
                case 'COLLECTIVE':
                    where.AND = [
                        { isHolidayOvertime: true },
                        { isNationalHoliday: false },
                        { isOffDay: false },
                    ]
                    break
                case 'OFFDAY':
                    where.isOffDay = true
                    break
                case 'ALL_HOLIDAY':
                    where.isHolidayOvertime = true
                    break
            }
        }

        return prisma.overtime.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        image: true,
                        workDays: true,
                        workingHourMode: true,
                        sites: { select: { name: true } },
                        departments: { select: { name: true } }
                    }
                },

                attendance: true,
            },
            skip: filters?.skip,
            take: filters?.take,
        })
    }

    async count(filters?: {
        userId?: string
        status?: OvertimeStatus
        startDate?: Date
        endDate?: Date
        siteId?: string
        departmentId?: string
        holidayType?: string
    }): Promise<number> {
        const where: Prisma.OvertimeWhereInput = {}

        if (filters?.userId) where.userId = filters.userId
        if (filters?.status) where.status = filters.status
        if (filters?.startDate && filters?.endDate) {
            where.createdAt = {
                gte: filters.startDate,
                lte: filters.endDate,
            }
        }

        if (filters?.siteId || filters?.departmentId) {
            where.user = {
                ...(filters.siteId && { siteId: filters.siteId }),
                ...(filters.departmentId && { departmentId: filters.departmentId })
            }
        }

        // Holiday Filters
        if (filters?.holidayType) {
            switch (filters.holidayType) {
                case 'REGULAR':
                    where.isHolidayOvertime = false
                    break
                case 'NATIONAL':
                    where.isNationalHoliday = true
                    break
                case 'COLLECTIVE':
                    where.AND = [
                        { isHolidayOvertime: true },
                        { isNationalHoliday: false },
                        { isOffDay: false },
                    ]
                    break
                case 'OFFDAY':
                    where.isOffDay = true
                    break
                case 'ALL_HOLIDAY':
                    where.isHolidayOvertime = true
                    break
            }
        }

        return prisma.overtime.count({ where })
    }

    async countByStatus(filters?: {
        userId?: string,
        startDate?: Date,
        endDate?: Date,
        siteId?: string,
        departmentId?: string
    }) {
        const where: Prisma.OvertimeWhereInput = {}

        if (filters?.userId) where.userId = filters.userId
        if (filters?.startDate && filters?.endDate) {
            where.createdAt = { gte: filters.startDate, lte: filters.endDate }
        }
        if (filters?.siteId || filters?.departmentId) {
            where.user = {
                ...(filters.siteId && { siteId: filters.siteId }),
                ...(filters.departmentId && { departmentId: filters.departmentId })
            }
        }

        const groups = await prisma.overtime.groupBy({
            by: ['status'],
            where,
            _count: { _all: true }
        })

        return groups.reduce((acc: Record<string, number>, curr: { status: string, _count: { _all: number } }) => {
            acc[curr.status] = curr._count._all
            return acc
        }, {} as Record<string, number>)
    }

    async create(data: Omit<Prisma.OvertimeCreateInput, 'id' | 'updatedAt'>): Promise<Overtime> {
        return prisma.overtime.create({
            data: {
                ...data,
                id: randomUUID(),
                updatedAt: new Date(),
            } as Prisma.OvertimeCreateInput,
        })
    }

    async update(id: string, data: Prisma.OvertimeUpdateInput): Promise<Overtime> {
        return prisma.overtime.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date(),
            },
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.overtime.delete({
            where: { id },
        })
    }

    async getStatsByDateRange(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const where: Prisma.OvertimeWhereInput = {
            createdAt: {
                gte: startDate,
                lte: endDate
            }
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        const stats = await prisma.overtime.aggregate({
            _count: { _all: true },
            _sum: { duration: true },
            where
        })

        return {
            totalRequests: stats._count._all,
            totalDuration: stats._sum.duration || 0
        }
    }

    async getDailyStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
        const effectiveTenantId = (!isSuperAdmin && !tenantId) ? '___MISSING_TENANT_ID___' : tenantId

        let query = Prisma.sql`
            SELECT
                TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date,
                COUNT(*)::int as requests,
                SUM(o.duration)::int as duration
            FROM "Overtime" o
        `

        if (siteId || departmentId) {
            query = Prisma.sql`${query} JOIN "User" u ON o."userId" = u.id`
        }

        query = Prisma.sql`${query} 
            WHERE o."createdAt" >= ${startDate}
            AND o."createdAt" <= ${endDate}
        `

        if (!isSuperAdmin) {
            query = Prisma.sql`${query} AND o."tenantId" = ${effectiveTenantId}`
        }

        if (siteId) {
            query = Prisma.sql`${query} AND u."siteId" = ${siteId}`
        }
        if (departmentId) {
            query = Prisma.sql`${query} AND u."departmentId" = ${departmentId}`
        }
        
        query = Prisma.sql`${query} GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')`

        const stats = await prisma.$queryRaw<{ date: string, requests: number, duration: number }[]>(query)

        return stats.map((s: { date: string, requests: number, duration: number }) => ({
            date: s.date,
            requests: Number(s.requests),
            duration: Number(s.duration || 0)
        })).sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
    }

    async getGroupedStats(startDate: Date, endDate: Date, groupBy: 'department' | 'site') {
        let groupByColumn = Prisma.sql``
        let groupByNameColumn = Prisma.sql``
        let joinTable = Prisma.sql``

        if (groupBy === 'site') {
            groupByColumn = Prisma.sql`u."siteId"`
            joinTable = Prisma.sql`JOIN "sites" s ON u."siteId" = s.id`
            groupByNameColumn = Prisma.sql`s.name`
        } else {
            groupByColumn = Prisma.sql`u."departmentId"`
            joinTable = Prisma.sql`JOIN "departments" d ON u."departmentId" = d.id`
            groupByNameColumn = Prisma.sql`d.name`
        }

        const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
        const effectiveTenantId = (!isSuperAdmin && !tenantId) ? '___MISSING_TENANT_ID___' : tenantId

        const query = Prisma.sql`
            SELECT
                ${groupByNameColumn} as name,
                COUNT(*)::int as requests,
                SUM(o.duration)::int as duration
            FROM "Overtime" o
            JOIN "User" u ON o."userId" = u.id
            ${joinTable}
            WHERE o."createdAt" >= ${startDate}
            AND o."createdAt" <= ${endDate}
            ${!isSuperAdmin ? Prisma.sql`AND o."tenantId" = ${effectiveTenantId}` : Prisma.empty}
            GROUP BY ${groupByColumn}, ${groupByNameColumn}
        `

        const stats = await prisma.$queryRaw<{ name: string, requests: number, duration: number }[]>(query)

        return stats.map((s: { name: string, requests: number, duration: number }) => ({
            name: s.name,
            requests: Number(s.requests),
            duration: Number(s.duration || 0)
        }))
    }

    async getTopEmployees(startDate: Date, endDate: Date, limit: number = 5, siteId?: string, departmentId?: string) {
        const where: Prisma.OvertimeWhereInput = {
            createdAt: { gte: startDate, lte: endDate },
            status: { in: ['APPROVED', 'COMPLETED'] }
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        const groups = await prisma.overtime.groupBy({
            by: ['userId'],
            where,
            _sum: { duration: true }
        })

        // Sort by total duration desc
        groups.sort((a: { _sum: { duration: number | null } }, b: { _sum: { duration: number | null } }) => (b._sum.duration || 0) - (a._sum.duration || 0))
        const topIds = groups.slice(0, limit)

        const users = await prisma.user.findMany({
            where: { id: { in: topIds.map((g: { userId: string }) => g.userId) } },
            select: { id: true, name: true, image: true, sites: { select: { name: true } }, departments: { select: { name: true } } }
        })

        return topIds.map((g: { userId: string, _sum: { duration: number | null } }) => {
            const user = users.find((u: { id: string }) => u.id === g.userId)
            return {
                user,
                totalDuration: g._sum.duration || 0
            }
        }).filter((item: { user: { id: string } | undefined }) => item.user != null)
    }

    async getUserOvertimeStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const where: Prisma.OvertimeWhereInput = {
            createdAt: { gte: startDate, lte: endDate },
            status: { in: ['APPROVED', 'COMPLETED'] }
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        return prisma.overtime.groupBy({
            by: ['userId'],
            where,
            _sum: { duration: true }
        })
    }
}
