import { Attendance } from '../entities/Attendance'
import { AttendanceStatusEnum } from '../value-objects/AttendanceStatus'

export interface AttendanceFindManyParams {
  userId?: string
  tenantId?: string
  startDate?: Date
  endDate?: Date
  status?: AttendanceStatusEnum
  page?: number
  limit?: number
}

export interface AttendanceStatsResult {
  status: string
  count: number
}

export interface DailyStatsResult {
  date: string
  present: number
  late: number
  absent: number
  onLeave: number
  dayOff: number
  total: number
}

export interface AttendanceRepositoryInterface {
  findById(id: string, tenantId?: string): Promise<Attendance | null>
  findActiveByUserId(userId: string, tenantId?: string): Promise<Attendance | null>
  findByUserIdAndDate(userId: string, date: Date, tenantId?: string): Promise<Attendance | null>
  findMany(params: AttendanceFindManyParams): Promise<{ data: Attendance[]; total: number }>
  count(params: Omit<AttendanceFindManyParams, 'page' | 'limit'>): Promise<number>
  save(attendance: Attendance): Promise<Attendance>
  update(attendance: Attendance): Promise<Attendance>
  delete(id: string, tenantId?: string): Promise<void>
  getStatsByDateRange(startDate: Date, endDate: Date, siteId?: string, deptId?: string, tenantId?: string): Promise<AttendanceStatsResult[]>
  getDailyStats(startDate: Date, endDate: Date, siteId?: string, deptId?: string, tenantId?: string): Promise<DailyStatsResult[]>
}
