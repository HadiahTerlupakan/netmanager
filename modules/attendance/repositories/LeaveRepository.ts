import { prisma } from '@/lib/prisma'
import { LeaveStatus, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

export class LeaveRepository {
    async create(data: Omit<Prisma.LeaveRequestUncheckedCreateInput, 'id' | 'updatedAt'>) {
        return prisma.leaveRequest.create({
            data: {
                ...data,
                id: randomUUID(),
                updatedAt: new Date()
            }
        })
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
            include: { user: { select: { name: true, departments: { select: { name: true } }, sites: { select: { name: true } } } } }
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
        tenantId?: string
    }) {
        const where: Prisma.LeaveRequestWhereInput = { tenantId: filters?.tenantId }

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
                user: { select: { name: true, image: true, departments: { select: { name: true } }, sites: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' },
            ...(filters?.skip !== undefined ? { skip: filters.skip } : {}),
            ...(filters?.take !== undefined ? { take: filters.take } : {})
        })
    }

    async count(filters?: {
        userId?: string
        status?: LeaveStatus
        departmentId?: string
        siteId?: string
        tenantId?: string
    }) {
        const where: Prisma.LeaveRequestWhereInput = { tenantId: filters?.tenantId }

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

    async getUserLeaveStats(startDate: Date, endDate: Date, siteId?: string, departmentId?: string, tenantId?: string) {
        const where: Prisma.LeaveRequestWhereInput = {
            status: 'APPROVED',
            startDate: { lte: endDate },
            endDate: { gte: startDate },
            tenantId
        }

        if (siteId || departmentId) {
            where.user = {
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        return prisma.leaveRequest.groupBy({
            by: ['userId'],
            where,
            _count: { _all: true }
        })
    }

    /**
     * Find active approved leave for a user on a specific date range.
     * Used by AttendanceValidationService to check if user is on leave.
     */
    async findActiveLeaveForUserOnDate(
        userId: string,
        startOfDay: Date,
        endOfDay: Date,
        tenantId?: string
    ) {
        return prisma.leaveRequest.findFirst({
            where: {
                userId,
                ...(tenantId && { tenantId }),
                status: 'APPROVED',
                startDate: { lte: endOfDay },
                endDate: { gte: startOfDay }
            },
            select: {
                type: true,
                reason: true
            }
        })
    }

    /**
     * Find approved leave for a user on a date range (for auto-alpha check).
     */
    async findApprovedLeaveForUserOnDateRange(
        userId: string,
        tenantId: string,
        startOfDay: Date,
        endOfDay: Date
    ) {
        return prisma.leaveRequest.findFirst({
            where: {
                userId,
                tenantId,
                status: 'APPROVED',
                startDate: { lte: endOfDay },
                endDate: { gte: startOfDay }
            }
        })
    }

    /**
     * Find leave by ID with user relation included.
     */
    async findByIdWithUser(id: string, tenantId: string) {
        return prisma.leaveRequest.findUnique({
            where: { id, tenantId },
            include: { user: true }
        })
    }

    /**
     * Find approved leaves in a date range with user relation included.
     */
    async findApprovedInRangeWithUser(startDate: Date, endDate: Date, tenantId: string, userId?: string) {
        return prisma.leaveRequest.findMany({
            where: {
                tenantId,
                status: 'APPROVED',
                ...(userId ? { userId } : {}),
                startDate: { lte: endDate },
                endDate: { gte: startDate }
            },
            include: { user: true }
        })
    }
}
