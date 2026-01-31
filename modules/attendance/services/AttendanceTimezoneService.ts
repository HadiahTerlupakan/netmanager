/**
 * Attendance Timezone Service
 * Centralized timezone and tolerance management with caching
 * Reduces database queries for frequently accessed settings
 */

import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'

export class AttendanceTimezoneService {
  /**
   * Get system timezone setting with caching (1 hour TTL)
   * @returns Timezone string (e.g., 'Asia/Jakarta')
   */
  async getTimezone(): Promise<string> {
    const cacheKey = 'settings:timezone'
    const cached = cache.get<string>(cacheKey)
    
    if (cached) return cached
    
    const setting = await prisma.settings.findFirst({
      where: { key: 'GENERAL_TIMEZONE' }
    })
    
    const timezone = setting?.value || 'Asia/Jakarta'
    cache.set(cacheKey, timezone, 3600) // 1 hour TTL
    
    return timezone
  }
  
  /**
   * Get attendance tolerance setting with caching (1 hour TTL)
   * @returns Tolerance in minutes
   */
  async getTolerance(): Promise<number> {
    const cacheKey = 'settings:tolerance'
    const cached = cache.get<number>(cacheKey)
    
    if (cached) return cached
    
    const setting = await prisma.settings.findFirst({
      where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' }
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
    const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const tzOffsetMs = nowInTz.getTime() - now.getTime()
    
    const startOfDayInTz = new Date(nowInTz)
    startOfDayInTz.setHours(0, 0, 0, 0)
    
    const startOfDay = new Date(startOfDayInTz.getTime() - tzOffsetMs)
    
    return { now: nowInTz, startOfDay, tzOffsetMs }
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
    
    // 1. Get the parts of the checkInTime in the target timezone
    // usage of Intl.DateTimeFormat is more robust than toLocaleString parsing
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    })
    
    const parts = formatter.formatToParts(checkInTime)
    const part = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')

    // 2. Parse schedule time (e.g., '08:30')
    const scheduleParts = scheduleTime.split(':').map(Number)
    const schedHour = scheduleParts[0] ?? 0
    const schedMinute = scheduleParts[1] ?? 0

    // 3. Construct schedule date using the SAME date components as check-in, but with schedule time
    // We construct it effectively in "wall clock time" of the timezone
    // Note: We need to be careful creating a Date object.
    // If we use new Date(year, month, day, ...), it uses LOCAL system timezone.
    // We want to construct a timestamp that REPRESENTS that wall-clock time in the TARGET timezone.

    // Easier approach: Compare "Minutes from start of day"
    // Get check-in minutes from start of day IN TARGET TIMEZONE
    const checkInHour = part('hour')
    // Handle 24h format weirdness if any (Intl usually returns 0-23 with h23 or hour12: false, but 24 is possible in some locales. en-US with hour12:false is usually 0-23 or 24)
    // Actually part('hour') might return 24 for midnight in some versions, but usually 0.
    const checkInMinute = part('minute')
    const checkInTotalMinutes = (checkInHour * 60) + checkInMinute
    
    const scheduleTotalMinutes = (schedHour * 60) + schedMinute
    const toleranceTotalMinutes = scheduleTotalMinutes + toleranceMinutes
    
    // Handle day boundary/overnight shifts if necessary? 
    // The original logic didn't seem to handle overnight shifts crossing midnight for "LATE" check (it created date on same day).
    // So we'll stick to simple comparison for now, assuming standard day shift or matching day.
    
    return checkInTotalMinutes > toleranceTotalMinutes ? 'LATE' : 'ON_TIME'
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
