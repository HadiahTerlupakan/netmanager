import { Leave } from '../entities/Leave'

export interface LeaveFindManyParams {
  userId?: string
  tenantId?: string
  startDate?: Date
  endDate?: Date
  status?: string
  page?: number
  limit?: number
}

export interface LeaveRepositoryInterface {
  findById(id: string, tenantId?: string): Promise<Leave | null>
  findMany(params: LeaveFindManyParams): Promise<{ data: Leave[]; total: number }>
  findApprovedByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date, tenantId?: string): Promise<Leave[]>
  hasApprovedLeaveOnDate(userId: string, date: Date, tenantId?: string): Promise<boolean>
  save(leave: Leave): Promise<Leave>
  update(leave: Leave): Promise<Leave>
  delete(id: string, tenantId?: string): Promise<void>
}
