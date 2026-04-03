/**
 * NotificationRepository
 *
 * Database operations for Notification entity.
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface NotificationFilters {
    userId?: string
    type?: string
    isRead?: boolean
    skip?: number
    take?: number
}

export interface CreateNotificationInput {
    userId: string
    title: string
    message: string
    type: string
    priority?: string
    link?: string
    sourceType?: string
    sourceId?: string
}

export class NotificationRepository {
    /**
     * Find all notifications for a user
     */
    async findByUserId(userId: string, filters: Omit<NotificationFilters, 'userId'> = {}) {
        const where: Record<string, unknown> = { userId }

        if (filters.type) {
            where.type = filters.type
        }

        if (filters.isRead !== undefined) {
            where.isRead = filters.isRead
        }

        const [data, total] = await Promise.all([
            prisma.notifications.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: filters.skip,
                take: filters.take,
            }),
            prisma.notifications.count({ where }),
        ])

        return { data, total }
    }

    /**
     * Find notification by ID
     */
    async findById(id: string) {
        return prisma.notifications.findUnique({
            where: { id },
        })
    }

    /**
     * Create notification
     */
    async create(data: CreateNotificationInput) {
        return prisma.notifications.create({
            data: {
                id: crypto.randomUUID(),
                title: data.title,
                message: data.message,
                type: data.type,
                priority: data.priority || 'NORMAL',
                link: data.link,
                sourceType: data.sourceType,
                sourceId: data.sourceId,
                user: data.userId ? { connect: { id: data.userId } } : undefined,
            },
        })
    }

    /**
     * Mark notification as read
     */
    async markAsRead(id: string) {
        return prisma.notifications.update({
            where: { id },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        })
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string) {
        return prisma.notifications.updateMany({
            where: {
                userId,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        })
    }

    /**
     * Delete notification
     */
    async delete(id: string) {
        return prisma.notifications.delete({
            where: { id },
        })
    }

    /**
     * Delete all notifications for a user
     */
    async deleteAllByUserId(userId: string) {
        return prisma.notifications.deleteMany({
            where: { userId },
        })
    }

    /**
     * Count unread notifications
     */
    async countUnread(userId: string) {
        return prisma.notifications.count({
            where: {
                userId,
                isRead: false,
            },
        })
    }

    /**
     * Get notification counts
     */
    async getCounts(userId: string) {
        const [total, unread] = await Promise.all([
            prisma.notifications.count({ where: { userId } }),
            prisma.notifications.count({ where: { userId, isRead: false } }),
        ])

        return { total, unread }
    }

    /**
     * Create notification with full data including departmentId, siteId, sourceType, sourceId, tenantId
     */
    async createFull(data: {
        id: string
        type: string
        priority: string
        title: string
        message: string
        link?: string | null
        userId?: string | null
        departmentId?: string | null
        siteId?: string | null
        sourceType?: string | null
        sourceId?: string | null
        tenantId?: string | null
    }) {
        return prisma.notifications.create({ data })
    }

    /**
     * Find many notifications with complex where clause for user notifications
     */
    async findManyForUser(where: Record<string, unknown>, options?: { take?: number; skip?: number }): Promise<unknown[]> {
        return prisma.notifications.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: options?.take || 50,
            skip: options?.skip || 0,
        })
    }

    /**
     * Count notifications with where clause
     */
    async countWhere(where: Record<string, unknown>): Promise<number> {
        return prisma.notifications.count({ where })
    }

    /**
     * Find single notification with complex where
     */
    async findFirst(where: Record<string, unknown>): Promise<unknown | null> {
        return prisma.notifications.findFirst({ where })
    }

    /**
     * UpdateMany notifications
     */
    async updateMany(where: Record<string, unknown>, data: Record<string, unknown>): Promise<{ count: number }> {
        return prisma.notifications.updateMany({ where, data })
    }

    async getUnreadCountRaw(
        userId: string,
        typeCondition: Prisma.Sql,
        siteCondition: Prisma.Sql,
        tenantCondition: Prisma.Sql
    ): Promise<number> {
        const result = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM "notifications" n
            WHERE n."isRead" = false ${typeCondition}
            ${tenantCondition}
            AND (n."userId" = ${userId} OR (n."departmentId" = (SELECT "departmentId" FROM "User" WHERE "id" = ${userId}) ${siteCondition}))
        `
        return Number(result[0]?.count || 0)
    }
}
