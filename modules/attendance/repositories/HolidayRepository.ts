import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { cache } from '@/lib/cache'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/datetime'


type Holiday = Prisma.HolidayGetPayload<object>

export class HolidayRepository {
    async create(data: Prisma.HolidayCreateInput) {
        const holiday = await prisma.holiday.create({ data })
        // Invalidate holiday cache after creating new holiday
        this.invalidateCache()
        return holiday
    }

    async update(id: string, data: Prisma.HolidayUpdateInput) {
        const holiday = await prisma.holiday.update({
            where: { id },
            data
        })
        // Invalidate holiday cache after updating
        this.invalidateCache()
        return holiday
    }

    async delete(id: string) {
        const holiday = await prisma.holiday.delete({
            where: { id }
        })
        // Invalidate holiday cache after deleting
        this.invalidateCache()
        return holiday
    }

    async findMany(params?: {
        where?: Prisma.HolidayWhereInput
        orderBy?: Prisma.HolidayOrderByWithRelationInput
    }) {
        return prisma.holiday.findMany(params)
    }

    async isHoliday(date: Date, tenantId?: string): Promise<{ isHoliday: boolean, holiday?: Holiday | null }> {
        // Check cache first (24h TTL)
        const dateStr = date.toISOString().split('T')[0]
        const cacheKey = `holiday:${tenantId || 'global'}:${dateStr}`
        const cached = cache.get<{ isHoliday: boolean, holiday?: Holiday | null }>(cacheKey)

        if (cached) return cached

        // Normalize date to YYYY-MM-DD for comparison
        const startOfDay = new Date(date)
        startOfDay.setTime(toStartOfDay(startOfDay).getTime())

        const endOfDay = new Date(startOfDay)
        endOfDay.setTime(toEndOfDay(endOfDay).getTime())

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
        cache.set(cacheKey, result, 86400)

        return result
    }

    async getHolidaysByYear(year: number, tenantId?: string): Promise<Holiday[]> {
        // Check cache first (24h TTL)
        const cacheKey = `holidays:year:${year}:${tenantId || 'global'}`
        const cached = cache.get<Holiday[]>(cacheKey)

        if (cached) return cached
        
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
        cache.set(cacheKey, holidays, 86400)
        
        return holidays
    }
    
    /**
     * Invalidate all holiday-related cache entries
     * Call this after creating, updating, or deleting holidays
     */
    invalidateCache(): void {
        cache.invalidate('holiday:')
        cache.invalidate('holidays:')
    }
}
