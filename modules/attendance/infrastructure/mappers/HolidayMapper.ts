import { Prisma, type Holiday as PrismaHoliday } from '@prisma/client'
import { Holiday } from '../../domain/entities/Holiday'

export class HolidayMapper {
  static toDomain(prisma: PrismaHoliday): Holiday {
    return new Holiday({
      id: prisma.id,
      date: prisma.date,
      description: prisma.description,
      isNational: prisma.isNational,
      tenantId: prisma.tenantId,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    })
  }

  static toPrismaCreate(domain: Holiday): Prisma.HolidayUncheckedCreateInput {
    return {
      id: domain.id,
      date: domain.date,
      description: domain.description,
      isNational: domain.isNational,
      tenantId: domain.tenantId,
      updatedAt: domain.updatedAt,
    }
  }

  static toDomainList(prismaList: PrismaHoliday[]): Holiday[] {
    return prismaList.map((p) => this.toDomain(p))
  }
}
