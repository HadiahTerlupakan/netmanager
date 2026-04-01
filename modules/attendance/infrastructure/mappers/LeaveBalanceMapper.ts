import { Prisma, type LeaveBalance as PrismaLeaveBalance } from '@prisma/client'
import { LeaveBalance } from '../../domain/entities/LeaveBalance'
import { LeaveTypeEnum } from '../../domain/entities/Leave'

export class LeaveBalanceMapper {
  static toDomain(prisma: PrismaLeaveBalance): LeaveBalance {
    return new LeaveBalance({
      id: prisma.id,
      userId: prisma.userId,
      year: prisma.year,
      leaveType: prisma.leaveType as LeaveTypeEnum,
      quota: prisma.quota,
      used: prisma.used,
      tenantId: prisma.tenantId,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    })
  }

  static toDomainList(prismaList: PrismaLeaveBalance[]): LeaveBalance[] {
    return prismaList.map((p) => this.toDomain(p))
  }

  static toPrismaCreate(domain: LeaveBalance): Prisma.LeaveBalanceUncheckedCreateInput {
    return {
      id: domain.id,
      userId: domain.userId,
      year: domain.year,
      leaveType: domain.leaveType,
      quota: domain.quota,
      used: domain.used,
      tenantId: domain.tenantId,
      updatedAt: domain.updatedAt,
    }
  }
}
