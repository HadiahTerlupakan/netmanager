import { prisma } from '@/lib/prisma'
import { IOvertimeRepository } from './IOvertimeRepository'
import { Overtime, OvertimeStatus, Prisma } from '@prisma/client'

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
                        site: { select: { name: true } },
                        department: { select: { name: true } }
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

    async create(data: Prisma.OvertimeCreateInput): Promise<Overtime> {
        return prisma.overtime.create({
            data,
        })
    }

    async update(id: string, data: Prisma.OvertimeUpdateInput): Promise<Overtime> {
        return prisma.overtime.update({
            where: { id },
            data,
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
        const where: Prisma.OvertimeWhereInput = {
            createdAt: { gte: startDate, lte: endDate }
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        const records = await prisma.overtime.findMany({
            where,
            select: {
                createdAt: true,
                duration: true
            }
        })

        const dailyMap = new Map<string, { requests: number, duration: number }>()

        records.forEach(rec => {
            const dateKey = rec.createdAt.toISOString().split('T')[0]
            if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, { requests: 0, duration: 0 })
            }
            const stat = dailyMap.get(dateKey)!
            stat.requests++
            stat.duration += (rec.duration || 0)
        })

        return Array.from(dailyMap.entries()).map(([date, stat]) => ({
            date,
            ...stat
        })).sort((a, b) => a.date.localeCompare(b.date))
    }

    async getGroupedStats(startDate: Date, endDate: Date, groupBy: 'department' | 'site') {
        const overtimes = await prisma.overtime.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate }
            },
            include: {
                user: {
                    include: { site: true, department: true }
                }
            }
        })

        const groups = new Map<string, { name: string, requests: number, duration: number }>()

        overtimes.forEach(ot => {
            const user = ot.user
            if (!user) return

            let groupKey = 'Unknown'
            let groupName = 'Unknown'

            if (groupBy === 'site' && user.site) {
                groupKey = user.site.id
                groupName = user.site.name
            } else if (groupBy === 'department' && user.department) {
                groupKey = user.department.name // Group by name
                groupName = user.department.name
            }

            if (!groups.has(groupKey)) {
                groups.set(groupKey, { name: groupName, requests: 0, duration: 0 })
            }

            const stat = groups.get(groupKey)!
            stat.requests++
            stat.duration += (ot.duration || 0)
        })

        return Array.from(groups.values())
    }

    async getTopEmployees(startDate: Date, endDate: Date, limit: number = 5, siteId?: string, departmentId?: string) {
        const where: Prisma.OvertimeWhereInput = {
            createdAt: { gte: startDate, lte: endDate },
            status: 'COMPLETED'
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
            select: { id: true, name: true, image: true, site: { select: { name: true } }, department: { select: { name: true } } }
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
            status: 'COMPLETED'
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
