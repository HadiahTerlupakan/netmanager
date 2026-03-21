/**
 * Attendance Timezone Service
 * Centralized timezone and tolerance management with caching
 * Reduces database queries for frequently accessed settings
 */

import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { toZonedTime, toDate } from 'date-fns-tz'
import { startOfDay as fnsStartOfDay, differenceInMinutes, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns'

export class AttendanceTimezoneService {
  /**
   * Get system timezone setting with caching (1 hour TTL)
   * @param tenantId - Optional tenant ID
   * @returns Timezone string (e.g., 'Asia/Jakarta')
   */
  async getTimezone(tenantId?: string): Promise<string> {
    const cacheKey = `settings:timezone${tenantId ? `:${tenantId}` : ''}`
    const cached = cache.get<string>(cacheKey)
    
    if (cached) return cached
    
    const setting = await prisma.settings.findFirst({
      where: { 
        key: 'GENERAL_TIMEZONE',
        ...(tenantId && { tenantId })
      }
    })
    
    const timezone = setting?.value || 'Asia/Jakarta'
    cache.set(cacheKey, timezone, 3600) // 1 hour TTL
    
    return timezone
  }
  
  /**
   * Get attendance tolerance setting with caching (1 hour TTL)
   * @param tenantId - Optional tenant ID
   * @returns Tolerance in minutes
   */
  async getTolerance(tenantId?: string): Promise<number> {
    const cacheKey = `settings:tolerance${tenantId ? `:${tenantId}` : ''}`
    const cached = cache.get<number>(cacheKey)
    
    if (cached) return cached
    
    const setting = await prisma.settings.findFirst({
      where: { 
        key: 'GENERAL_ATTENDANCE_TOLERANCE',
        ...(tenantId && { tenantId })
      }
    })
    
    const tolerance = setting?.value ? parseInt(setting.value) : 0
    cache.set(cacheKey, tolerance, 3600) // 1 hour TTL
    
    return tolerance
  }
  
  /**
   * Get effective date context for a given timezone
   * Returns the current time, start of day, and timezone offset
   * 
   * @param timezone - Timezone string (e.g., 'Asia/Jakarta')
   * @returns Object with now, startOfDay, and tzOffsetMs
   */
  getEffectiveDate(timezone: string): {
    now: Date
    startOfDay: Date
    tzOffsetMs: number
  } {
    const now = new Date()
    const zonedNow = toZonedTime(now, timezone)
    const localStartOfDay = fnsStartOfDay(zonedNow)
    const startOfDay = toDate(localStartOfDay, { timeZone: timezone })
    const tzOffsetMs = zonedNow.getTime() - now.getTime()
    
    return { now: zonedNow, startOfDay, tzOffsetMs }
  }
  
  /**
   * Calculate attendance status (ON_TIME or LATE) based on check-in time and schedule
   * 
   * @param checkInTime - The actual check-in time
   * @param scheduleTime - The scheduled start time (e.g., '08:00')
   * @param timezone - Optional timezone (defaults to system timezone)
   * @returns 'ON_TIME' or 'LATE'
   */
  async calculateStatus(
    checkInTime: Date,
    scheduleTime: string,
    timezone?: string
  ): Promise<'ON_TIME' | 'LATE'> {
    const tz = timezone || await this.getTimezone()
    const toleranceMinutes = await this.getTolerance()
    
    const scheduleParts = scheduleTime.split(':').map(Number)
    const schedHour = scheduleParts[0] ?? 0
    const schedMinute = scheduleParts[1] ?? 0
    
    const zonedCheckInTime = toZonedTime(checkInTime, tz)
    
    let zonedScheduleTime = fnsStartOfDay(zonedCheckInTime)
    zonedScheduleTime = setHours(zonedScheduleTime, schedHour)
    zonedScheduleTime = setMinutes(zonedScheduleTime, schedMinute)
    zonedScheduleTime = setSeconds(zonedScheduleTime, 0)
    zonedScheduleTime = setMilliseconds(zonedScheduleTime, 0)
    
    const scheduleUtcDate = toDate(zonedScheduleTime, { timeZone: tz })
    
    const diffMinutes = differenceInMinutes(checkInTime, scheduleUtcDate)
    
    return diffMinutes > toleranceMinutes ? 'LATE' : 'ON_TIME'
  }
  
  /**
   * Invalidate timezone and tolerance cache
   * Call this when settings are updated
   */
  invalidateCache(): void {
    cache.invalidate('settings:timezone')
    cache.invalidate('settings:tolerance')
  }
}
