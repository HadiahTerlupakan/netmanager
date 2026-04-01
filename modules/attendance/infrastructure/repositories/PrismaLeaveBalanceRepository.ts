import { prisma } from '@/lib/prisma'
import { LeaveBalance } from '../../domain/entities/LeaveBalance'
import { LeaveTypeEnum } from '../../domain/entities/Leave'
import type { LeaveBalanceRepositoryInterface } from '../../domain/repositories/LeaveBalanceRepository'
import { LeaveBalanceMapper } from '../mappers/LeaveBalanceMapper'

export class PrismaLeaveBalanceRepository implements LeaveBalanceRepositoryInterface {
  async getBalance(
    userId: string,
    year: number,
    type: LeaveTypeEnum,
    tenantId?: string,
  ): Promise<LeaveBalance | null> {
    const record = await prisma.leaveBalance.findUnique({
      where: {
        userId_year_leaveType: { userId, year, leaveType: type },
      },
    })
    if (!record) return null
    if (tenantId && record.tenantId !== tenantId) return null
    return LeaveBalanceMapper.toDomain(record)
  }

  async getUserBalances(userId: string, year: number, tenantId?: string): Promise<LeaveBalance[]> {
    const records = await prisma.leaveBalance.findMany({
      where: { userId, year, ...(tenantId && { tenantId }) },
    })
    return LeaveBalanceMapper.toDomainList(records)
  }

  async incrementUsed(
    userId: string,
    year: number,
    type: LeaveTypeEnum,
    days: number,
    tenantId?: string,
  ): Promise<void> {
    await prisma.leaveBalance.updateMany({
      where: { userId, year, leaveType: type, ...(tenantId && { tenantId }) },
      data: { used: { increment: days }, updatedAt: new Date() },
    })
  }

  async decrementUsed(
    userId: string,
    year: number,
    type: LeaveTypeEnum,
    days: number,
    tenantId?: string,
  ): Promise<void> {
    await prisma.leaveBalance.updateMany({
      where: { userId, year, leaveType: type, ...(tenantId && { tenantId }) },
      data: { used: { decrement: days }, updatedAt: new Date() },
    })
  }

  async hasEnoughDays(
    userId: string,
    year: number,
    type: LeaveTypeEnum,
    required: number,
    tenantId?: string,
  ): Promise<boolean> {
    const balance = await this.getBalance(userId, year, type, tenantId)
    return balance ? balance.hasEnough(required) : false
  }

  async save(balance: LeaveBalance): Promise<LeaveBalance> {
    const record = await prisma.leaveBalance.upsert({
      where: {
        userId_year_leaveType: {
          userId: balance.userId,
          year: balance.year,
          leaveType: balance.leaveType,
        },
      },
      create: LeaveBalanceMapper.toPrismaCreate(balance),
      update: {
        quota: balance.quota,
        used: balance.used,
        updatedAt: new Date(),
      },
    })
    return LeaveBalanceMapper.toDomain(record)
  }
}
