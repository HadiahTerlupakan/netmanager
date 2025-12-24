import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export class HolidayRepository {
    async create(data: Prisma.HolidayCreateInput) {
        return prisma.holiday.create({ data })
    }

    async update(id: string, data: Prisma.HolidayUpdateInput) {
        return prisma.holiday.update({
            where: { id },
            data
        })
    }

    async delete(id: string) {
        return prisma.holiday.delete({
            where: { id }
        })
    }

    async findMany(params?: {
        where?: Prisma.HolidayWhereInput
        orderBy?: Prisma.HolidayOrderByWithRelationInput
    }) {
        return prisma.holiday.findMany(params)
    }

    async isHoliday(date: Date): Promise<{ isHoliday: boolean, holiday?: any }> {
        // Normalize date to YYYY-MM-DD for comparison
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(startOfDay)
        endOfDay.setHours(23, 59, 59, 999)

        const holiday = await prisma.holiday.findFirst({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        })

        return {
            isHoliday: !!holiday,
            holiday
        }
    }

    async getHolidaysByYear(year: number) {
        const startDate = new Date(year, 0, 1) // Jan 1st
        const endDate = new Date(year, 11, 31, 23, 59, 59) // Dec 31st

        return prisma.holiday.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: {
                date: 'asc'
            }
        })
    }
}
