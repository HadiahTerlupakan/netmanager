import { LeaveBalance } from '../entities/LeaveBalance'
import { LeaveTypeEnum } from '../entities/Leave'

export interface LeaveBalanceRepositoryInterface {
  getBalance(userId: string, year: number, type: LeaveTypeEnum, tenantId?: string): Promise<LeaveBalance | null>
  getUserBalances(userId: string, year: number, tenantId?: string): Promise<LeaveBalance[]>
  incrementUsed(userId: string, year: number, type: LeaveTypeEnum, days: number, tenantId?: string): Promise<void>
  decrementUsed(userId: string, year: number, type: LeaveTypeEnum, days: number, tenantId?: string): Promise<void>
  hasEnoughDays(userId: string, year: number, type: LeaveTypeEnum, required: number, tenantId?: string): Promise<boolean>
  save(balance: LeaveBalance): Promise<LeaveBalance>
}
