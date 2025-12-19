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
}
