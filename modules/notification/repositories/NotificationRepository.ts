/**
 * NotificationRepository
 *
 * Database operations for Notification entity.
 */

import { prisma } from '@/lib/prisma'

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
}
