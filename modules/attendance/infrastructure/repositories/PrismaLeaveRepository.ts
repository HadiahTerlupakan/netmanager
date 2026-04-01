import { prisma } from '@/lib/prisma'
import { Prisma, LeaveStatus as PrismaLeaveStatus } from '@prisma/client'
import { Leave } from '../../domain/entities/Leave'
import type {
  LeaveRepositoryInterface,
  LeaveFindManyParams,
} from '../../domain/repositories/LeaveRepository'
import { LeaveMapper } from '../mappers/LeaveMapper'

export class PrismaLeaveRepository implements LeaveRepositoryInterface {
  async findById(id: string, tenantId?: string): Promise<Leave | null> {
    const record = await prisma.leaveRequest.findFirst({
      where: { id, ...(tenantId && { tenantId }) },
    })
    return record ? LeaveMapper.toDomain(record) : null
  }

  async findMany(params: LeaveFindManyParams): Promise<{ data: Leave[]; total: number }> {
    const { userId, tenantId, startDate, endDate, status, page = 1, limit = 20 } = params

    const where: Prisma.LeaveRequestWhereInput = {
      ...(userId && { userId }),
      ...(tenantId && { tenantId }),
      ...(status && { status: status as PrismaLeaveStatus }),
      ...(startDate || endDate
        ? {
            startDate: { ...(startDate && { gte: startDate }) },
            endDate: { ...(endDate && { lte: endDate }) },
          }
        : {}),
    }

    const [records, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ])

    return {
      data: LeaveMapper.toDomainList(records),
      total,
    }
  }

  async findApprovedByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<Leave[]> {
    const records = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        ...(tenantId && { tenantId }),
      },
    })
    return LeaveMapper.toDomainList(records)
  }

  async hasApprovedLeaveOnDate(userId: string, date: Date, tenantId?: string): Promise<boolean> {
    const count = await prisma.leaveRequest.count({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: date },
        endDate: { gte: date },
        ...(tenantId && { tenantId }),
      },
    })
    return count > 0
  }

  async save(leave: Leave): Promise<Leave> {
    const record = await prisma.leaveRequest.create({
      data: LeaveMapper.toPrismaCreate(leave),
    })
    return LeaveMapper.toDomain(record)
  }

  async update(leave: Leave): Promise<Leave> {
    const record = await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: LeaveMapper.toPrismaUpdate(leave),
    })
    return LeaveMapper.toDomain(record)
  }

  async delete(id: string, tenantId?: string): Promise<void> {
    await prisma.leaveRequest.deleteMany({
      where: { id, ...(tenantId && { tenantId }) },
    })
  }
}
