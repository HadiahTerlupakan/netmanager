import { prisma } from '@/lib/prisma'
import { type IOvertimeRepository } from './IOvertimeRepository'
import { type Overtime, type OvertimeStatus, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

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

        return groups.reduce((acc, curr) => {
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
        const startStr = startDate.toISOString()
        const endStr = endDate.toISOString()

        let userJoin = ''
        let userCondition = ''

        if (siteId || departmentId) {
            userJoin = 'JOIN "User" u ON o."userId" = u.id'
            const conditions = []
            if (siteId) conditions.push(`u."siteId" = '${siteId}'`)
            if (departmentId) conditions.push(`u."departmentId" = '${departmentId}'`)
            if (conditions.length > 0) {
                userCondition = 'AND ' + conditions.join(' AND ')
            }
        }

        const stats = await prisma.$queryRawUnsafe<{ date: string, requests: number, duration: number }[]>(`
            SELECT
                TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date,
                COUNT(*)::int as requests,
                SUM(o.duration)::int as duration
            FROM "Overtime" o
            ${userJoin}
            WHERE o."createdAt" >= '${startStr}'::timestamp
            AND o."createdAt" <= '${endStr}'::timestamp
            ${userCondition}
            GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')
        `)

        return stats.map(s => ({
            date: s.date,
            requests: Number(s.requests),
            duration: Number(s.duration || 0)
        })).sort((a, b) => a.date.localeCompare(b.date))
    }

    async getGroupedStats(startDate: Date, endDate: Date, groupBy: 'department' | 'site') {
        const startStr = startDate.toISOString()
        const endStr = endDate.toISOString()

        let groupByColumn = ''
        let groupByNameColumn = ''
        let joinTable = ''

        if (groupBy === 'site') {
            groupByColumn = 'u."siteId"'
            joinTable = 'JOIN "sites" s ON u."siteId" = s.id'
            groupByNameColumn = 's.name'
        } else {
            groupByColumn = 'u."departmentId"'
            joinTable = 'JOIN "departments" d ON u."departmentId" = d.id'
            groupByNameColumn = 'd.name'
        }

        const stats = await prisma.$queryRawUnsafe<{ name: string, requests: number, duration: number }[]>(`
            SELECT
                ${groupByNameColumn} as name,
                COUNT(*)::int as requests,
                SUM(o.duration)::int as duration
            FROM "Overtime" o
            JOIN "User" u ON o."userId" = u.id
            ${joinTable}
            WHERE o."createdAt" >= '${startStr}'::timestamp
            AND o."createdAt" <= '${endStr}'::timestamp
            GROUP BY ${groupByColumn}, ${groupByNameColumn}
        `)

        return stats.map(s => ({
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
        groups.sort((a, b) => (b._sum.duration || 0) - (a._sum.duration || 0))
        const topIds = groups.slice(0, limit)

        const users = await prisma.user.findMany({
            where: { id: { in: topIds.map(g => g.userId) } },
            select: { id: true, name: true, image: true, sites: { select: { name: true } }, departments: { select: { name: true } } }
        })

        return topIds.map(g => {
            const user = users.find(u => u.id === g.userId)
            return {
                user,
                totalDuration: g._sum.duration || 0
            }
        }).filter(item => item.user != null)
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
