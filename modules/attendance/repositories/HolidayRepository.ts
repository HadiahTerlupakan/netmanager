import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { redis } from '@/lib/redis'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'


type Holiday = Prisma.HolidayGetPayload<object>

export class HolidayRepository {
    async create(data: Omit<Prisma.HolidayUncheckedCreateInput, 'tenantId'>, tenantId: string) {
        const holiday = await prisma.holiday.create({ 
            data: { ...data, tenantId } 
        })
        // Invalidate holiday cache after creating new holiday
        await this.invalidateCache(tenantId)
        return holiday
    }

    async update(id: string, data: Prisma.HolidayUncheckedUpdateInput, tenantId: string) {
        const holiday = await prisma.holiday.update({
            where: { id, tenantId },
            data
        })
        // Invalidate holiday cache after updating
        await this.invalidateCache(tenantId)
        return holiday
    }

    async delete(id: string, tenantId: string) {
        const holiday = await prisma.holiday.delete({
            where: { id, tenantId }
        })
        // Invalidate holiday cache after deleting
        await this.invalidateCache(tenantId)
        return holiday
    }

    async findMany(tenantId: string, params?: {
        where?: Prisma.HolidayWhereInput
        orderBy?: Prisma.HolidayOrderByWithRelationInput
    }) {
        return prisma.holiday.findMany({
            ...params,
            where: {
                ...params?.where,
                tenantId
            }
        })
    }

    async isHoliday(date: Date, tenantId: string): Promise<{ isHoliday: boolean, holiday?: Holiday | null }> {
        const startOfDay = new Date(date)
        startOfDay.setTime(toStartOfDay(startOfDay).getTime())

        const endOfDay = new Date(startOfDay)
        endOfDay.setTime(toEndOfDay(endOfDay).getTime())

        const cacheKey = `holiday:${tenantId}:${startOfDay.getTime()}`
        const cachedRaw = await redis.get(cacheKey)

        if (cachedRaw) return JSON.parse(cachedRaw) as { isHoliday: boolean, holiday?: Holiday | null }

        const holiday = await prisma.holiday.findFirst({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                tenantId
            }
        })

        const result = {
            isHoliday: !!holiday,
            holiday
        }

        // Cache result for 24 hours
        await redis.setex(cacheKey, 86400, JSON.stringify(result))

        return result
    }

    async getHolidaysByYear(year: number, tenantId: string): Promise<Holiday[]> {
        // Check cache first (24h TTL)
        const cacheKey = `holidays:${tenantId}:year:${year}`
        const cachedRaw = await redis.get(cacheKey)

        if (cachedRaw) return JSON.parse(cachedRaw) as Holiday[]
        
        const startDate = new Date(year, 0, 1) // Jan 1st
        const endDate = new Date(year, 11, 31, 23, 59, 59) // Dec 31st

        const holidays = await prisma.holiday.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                },
                tenantId
            },
            orderBy: {
                date: 'asc'
            }
        })
        
        // Cache result for 24 hours
        await redis.setex(cacheKey, 86400, JSON.stringify(holidays))
        
        return holidays
    }
    
    /**
     * Invalidate all holiday-related cache entries
     * Call this after creating, updating, or deleting holidays
     */
    async invalidateCache(tenantId: string): Promise<void> {
        const keys1 = await redis.keys(`holiday:${tenantId}:*`)
        const keys2 = await redis.keys(`holidays:${tenantId}:*`)
        const allKeys = [...keys1, ...keys2]
        if (allKeys.length > 0) {
            await redis.del(...allKeys)
        }
    }
}
