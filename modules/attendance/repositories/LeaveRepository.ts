import { prisma } from '@/lib/prisma'
import { LeaveStatus, Prisma } from '@prisma/client'
import type { LeaveRequest } from '@prisma/client'

export class LeaveRepository {
    async create(data: Prisma.LeaveRequestCreateInput) {
        return prisma.leaveRequest.create({ data })
    }

    async update(id: string, data: Prisma.LeaveRequestUpdateInput) {
        return prisma.leaveRequest.update({ where: { id }, data })
    }

    async delete(id: string) {
        return prisma.leaveRequest.delete({ where: { id } })
    }

    async findById(id: string) {
        return prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: { select: { name: true, department: { select: { name: true } }, site: { select: { name: true } } } } }
        })
    }

    async findAll(filters?: {
        userId?: string
        status?: LeaveStatus
        startDate?: Date
        endDate?: Date
        departmentId?: string
        siteId?: string
        skip?: number
        take?: number
    }) {
        const where: Prisma.LeaveRequestWhereInput = {}

        if (filters?.userId) where.userId = filters.userId
        if (filters?.status) where.status = filters.status
        if (filters?.startDate && filters?.endDate) {
            where.startDate = { gte: filters.startDate }
            where.endDate = { lte: filters.endDate }
        }

        if (filters?.departmentId || filters?.siteId) {
            where.user = {
                ...(filters.departmentId && { departmentId: filters.departmentId }),
                ...(filters.siteId && { siteId: filters.siteId })
            }
        }

        return prisma.leaveRequest.findMany({
            where,
            include: {
                user: { select: { name: true, image: true, department: { select: { name: true } }, site: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' },
            skip: filters?.skip,
            take: filters?.take
        })
    }

    async count(filters?: {
        userId?: string
        status?: LeaveStatus
        departmentId?: string
        siteId?: string
    }) {
        const where: Prisma.LeaveRequestWhereInput = {}

        if (filters?.userId) where.userId = filters.userId
        if (filters?.status) where.status = filters.status
        if (filters?.departmentId || filters?.siteId) {
            where.user = {
                ...(filters.departmentId && { departmentId: filters.departmentId }),
                ...(filters.siteId && { siteId: filters.siteId })
            }
        }

        return prisma.leaveRequest.count({ where })
    }
}
