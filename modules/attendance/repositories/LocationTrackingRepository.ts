import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface LocationData {
    latitude: number
    longitude: number
    accuracy?: number
    altitude?: number
    speed?: number
    heading?: number
    batteryLevel?: number
    isMoving?: boolean
    recordedAt?: Date
}

export class LocationTrackingRepository {
    async createLocation(userId: string, tenantId: string | null | undefined, data: LocationData) {
        return prisma.employeeLocation.create({
            data: {
                userId,
                tenantId,
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy ?? null,
                altitude: data.altitude ?? null,
                speed: data.speed ?? null,
                heading: data.heading ?? null,
                batteryLevel: data.batteryLevel ?? null,
                isMoving: data.isMoving ?? false,
                recordedAt: data.recordedAt ?? new Date(),
            }
        })
    }

    async createLocationsBatch(userId: string, tenantId: string | null | undefined, locations: LocationData[]) {
        return prisma.employeeLocation.createMany({
            data: locations.map(loc => ({
                userId,
                tenantId,
                latitude: loc.latitude,
                longitude: loc.longitude,
                accuracy: loc.accuracy ?? null,
                altitude: loc.altitude ?? null,
                speed: loc.speed ?? null,
                heading: loc.heading ?? null,
                batteryLevel: loc.batteryLevel ?? null,
                isMoving: loc.isMoving ?? false,
                recordedAt: loc.recordedAt ?? new Date(),
            }))
        })
    }

    async getLatestLocationsForUsers(userIds: string[], effectiveTenantId: string | null | undefined, isSuperAdmin: boolean) {
        return prisma.$queryRaw<Array<{
            userId: string
            latitude: number
            longitude: number
            accuracy: number | null
            speed: number | null
            heading: number | null
            isMoving: boolean
            batteryLevel: number | null
            recordedAt: Date
        }>>`
            SELECT DISTINCT ON ("userId") 
                "userId", latitude, longitude, accuracy, speed, 
                heading, "isMoving", "batteryLevel", "recordedAt"
            FROM "employee_locations"
            WHERE "userId" = ANY(${userIds})
            ${!isSuperAdmin && effectiveTenantId ? Prisma.sql`AND "tenantId" = ${effectiveTenantId}` : Prisma.empty}
            ORDER BY "userId", "recordedAt" DESC
        `
    }

    async findLocationsByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date) {
        return prisma.employeeLocation.findMany({
            where: {
                userId,
                recordedAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { recordedAt: 'asc' },
            select: {
                latitude: true,
                longitude: true,
                accuracy: true,
                speed: true,
                isMoving: true,
                recordedAt: true
            }
        })
    }

    async deleteLocationsBefore(date: Date) {
        return prisma.employeeLocation.deleteMany({
            where: {
                recordedAt: { lt: date }
            }
        })
    }
}
