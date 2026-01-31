/**
 * SystemLogRepository
 *
 * Database operations for SystemLog entity.
 */

import { prisma } from '@/lib/prisma'
import type { LogType } from '@prisma/client'

export interface SystemLogFilters {
    type?: LogType
    action?: string
    userId?: string
    startDate?: Date
    endDate?: Date
    search?: string
    skip?: number
    take?: number
}

export class SystemLogRepository {
    /**
     * Find all logs with filters
     */
    async findAll(filters: SystemLogFilters = {}) {
        const where: Record<string, unknown> = {}

        if (filters.type) {
            where.type = filters.type
        }

        if (filters.action) {
            where.action = filters.action
        }

        if (filters.userId) {
            where.userId = filters.userId
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {}
            if (filters.startDate) {
                (where.createdAt as Record<string, Date>).gte = filters.startDate
            }
            if (filters.endDate) {
                (where.createdAt as Record<string, Date>).lte = filters.endDate
            }
        }

        if (filters.search) {
            where.OR = [
                { subject: { contains: filters.search, mode: 'insensitive' } },
                { action: { contains: filters.search, mode: 'insensitive' } },
            ]
        }

        const [data, total] = await Promise.all([
            prisma.systemLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: filters.skip,
                take: filters.take,
            }),
            prisma.systemLog.count({ where }),
        ])

        return { data, total }
    }

    /**
     * Find log by ID
     */
    async findById(id: string) {
        return prisma.systemLog.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        })
    }

    /**
     * Get recent activity for timeline
     */
    async getRecentActivity(limit: number = 10) {
        return prisma.systemLog.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        })
    }

    /**
     * Get statistics by action
     */
    async getStatsByAction(startDate?: Date, endDate?: Date) {
        const where: Record<string, unknown> = {}

        if (startDate || endDate) {
            where.createdAt = {}
            if (startDate) {
                (where.createdAt as Record<string, Date>).gte = startDate
            }
            if (endDate) {
                (where.createdAt as Record<string, Date>).lte = endDate
            }
        }

        return prisma.systemLog.groupBy({
            by: ['action'],
            where,
            _count: { _all: true },
        })
    }

    /**
     * Get statistics by subject
     */
    async getStatsBySubject(startDate?: Date, endDate?: Date) {
        const where: Record<string, unknown> = {}

        if (startDate || endDate) {
            where.createdAt = {}
            if (startDate) {
                (where.createdAt as Record<string, Date>).gte = startDate
            }
            if (endDate) {
                (where.createdAt as Record<string, Date>).lte = endDate
            }
        }

        return prisma.systemLog.groupBy({
            by: ['subject'],
            where,
            _count: { _all: true },
        })
    }

    /**
     * Count total logs
     */
    async count(filters: SystemLogFilters = {}) {
        const where: Record<string, unknown> = {}

        if (filters.type) where.type = filters.type
        if (filters.action) where.action = filters.action
        if (filters.userId) where.userId = filters.userId

        return prisma.systemLog.count({ where })
    }
}
