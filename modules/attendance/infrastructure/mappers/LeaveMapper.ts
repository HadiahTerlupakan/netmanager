import { Prisma, type LeaveRequest as PrismaLeaveRequest } from '@prisma/client'
import { Leave, LeaveTypeEnum, LeaveStatusEnum } from '../../domain/entities/Leave'

export class LeaveMapper {
  static toDomain(prisma: PrismaLeaveRequest): Leave {
    return new Leave({
      id: prisma.id,
      userId: prisma.userId,
      type: prisma.type as LeaveTypeEnum,
      startDate: prisma.startDate,
      endDate: prisma.endDate,
      reason: prisma.reason,
      attachmentUrl: prisma.attachmentUrl,
      attachments: prisma.attachments || [],
      status: prisma.status as LeaveStatusEnum,
      approvedBy: prisma.approvedBy,
      rejectionReason: prisma.rejectionReason,
      replacementDate: prisma.replacementDate,
      tenantId: prisma.tenantId,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    })
  }

  static toDomainList(prismaList: PrismaLeaveRequest[]): Leave[] {
    return prismaList.map((p) => this.toDomain(p))
  }

  static toPrismaCreate(domain: Leave): Prisma.LeaveRequestUncheckedCreateInput {
    return {
      id: domain.id,
      userId: domain.userId,
      type: domain.type,
      startDate: domain.startDate,
      endDate: domain.endDate,
      reason: domain.reason,
      attachmentUrl: domain.attachmentUrl,
      attachments: domain.attachments,
      status: domain.status,
      approvedBy: domain.approvedBy,
      rejectionReason: domain.rejectionReason,
      replacementDate: domain.replacementDate,
      tenantId: domain.tenantId,
      updatedAt: domain.updatedAt,
    }
  }

  static toPrismaUpdate(domain: Leave): Prisma.LeaveRequestUncheckedUpdateInput {
    return {
      type: domain.type,
      startDate: domain.startDate,
      endDate: domain.endDate,
      reason: domain.reason,
      attachmentUrl: domain.attachmentUrl,
      attachments: domain.attachments,
      status: domain.status,
      approvedBy: domain.approvedBy,
      rejectionReason: domain.rejectionReason,
      replacementDate: domain.replacementDate,
      updatedAt: new Date(),
    }
  }
}
