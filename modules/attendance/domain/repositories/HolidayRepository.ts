import { Holiday } from '../entities/Holiday'

export interface HolidayRepositoryInterface {
  findById(id: string, tenantId?: string): Promise<Holiday | null>
  findByDate(date: Date, tenantId?: string): Promise<Holiday | null>
  findByYear(year: number, tenantId?: string): Promise<Holiday[]>
  findMany(tenantId: string, params?: { startDate?: Date; endDate?: Date }): Promise<Holiday[]>
  save(holiday: Holiday): Promise<Holiday>
  update(holiday: Holiday): Promise<Holiday>
  delete(id: string, tenantId?: string): Promise<void>
  isHoliday(date: Date, tenantId?: string): Promise<boolean>
}
