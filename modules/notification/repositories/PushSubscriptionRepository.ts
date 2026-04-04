import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export class PushSubscriptionRepository {
    async updateManyForEndpoints(endpoints: string[], data: { isActive: boolean }) {
        return prisma.pushSubscriptions.updateMany({
            where: {
                endpoint: { in: endpoints },
            },
            data,
        })
    }

    async findManyByUserIds(userIds: string[]) {
        return prisma.pushSubscriptions.findMany({
            where: {
                isActive: true,
                userId: { in: userIds },
            },
            select: {
                endpoint: true,
                p256dh: true,
                auth: true,
            },
        })
    }

    async findByEndpoint(endpoint: string) {
        return prisma.pushSubscriptions.findUnique({
            where: { endpoint },
        })
    }

    async updateByEndpoint(endpoint: string, data: { isActive?: boolean; updatedAt?: Date }) {
        return prisma.pushSubscriptions.update({
            where: { endpoint },
            data: {
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.updatedAt && { updatedAt: data.updatedAt }),
            },
        })
    }

    async create(data: {
        id?: string
        userId: string
        endpoint: string
        p256dh: string
        auth: string
        userAgent?: string | null
        updatedAt?: Date
    }) {
        return prisma.pushSubscriptions.create({
            data: {
                id: data.id || randomUUID(),
                updatedAt: data.updatedAt || new Date(),
                userId: data.userId,
                endpoint: data.endpoint,
                p256dh: data.p256dh,
                auth: data.auth,
                userAgent: data.userAgent || null,
            },
        })
    }

    async updateManyByEndpoint(endpoint: string, data: { isActive: boolean; updatedAt: Date }) {
        return prisma.pushSubscriptions.updateMany({
            where: { endpoint },
            data,
        })
    }
}
