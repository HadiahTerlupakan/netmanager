import { prisma } from '@/lib/prisma'
import type { Holiday } from '../../domain/entities/Holiday'
import type { HolidayRepositoryInterface } from '../../domain/repositories/HolidayRepository'
import { HolidayMapper } from '../mappers/HolidayMapper'

export class PrismaHolidayRepository implements HolidayRepositoryInterface {
  async findById(id: string, tenantId?: string): Promise<Holiday | null> {
    const record = await prisma.holiday.findFirst({
      where: { id, ...(tenantId && { tenantId }) },
    })
    return record ? HolidayMapper.toDomain(record) : null
  }

  async findByDate(date: Date, tenantId?: string): Promise<Holiday | null> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const record = await prisma.holiday.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        ...(tenantId && { tenantId }),
      },
    })
    return record ? HolidayMapper.toDomain(record) : null
  }

  async findByYear(year: number, tenantId?: string): Promise<Holiday[]> {
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)

    const records = await prisma.holiday.findMany({
      where: {
        date: { gte: startOfYear, lte: endOfYear },
        ...(tenantId && { tenantId }),
      },
      orderBy: { date: 'asc' },
    })
    return HolidayMapper.toDomainList(records)
  }

  async findMany(tenantId: string, params?: { startDate?: Date; endDate?: Date }): Promise<Holiday[]> {
    const records = await prisma.holiday.findMany({
      where: {
        tenantId,
        ...(params?.startDate || params?.endDate
          ? {
              date: {
                ...(params.startDate && { gte: params.startDate }),
                ...(params.endDate && { lte: params.endDate }),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    })
    return HolidayMapper.toDomainList(records)
  }

  async save(holiday: Holiday): Promise<Holiday> {
    const record = await prisma.holiday.create({
      data: HolidayMapper.toPrismaCreate(holiday),
    })
    return HolidayMapper.toDomain(record)
  }

  async update(holiday: Holiday): Promise<Holiday> {
    const record = await prisma.holiday.update({
      where: { id: holiday.id },
      data: {
        date: holiday.date,
        description: holiday.description,
        isNational: holiday.isNational,
        updatedAt: new Date(),
      },
    })
    return HolidayMapper.toDomain(record)
  }

  async delete(id: string, tenantId?: string): Promise<void> {
    await prisma.holiday.deleteMany({
      where: { id, ...(tenantId && { tenantId }) },
    })
  }

  async isHoliday(date: Date, tenantId?: string): Promise<boolean> {
    const holiday = await this.findByDate(date, tenantId)
    return holiday !== null
  }
}
