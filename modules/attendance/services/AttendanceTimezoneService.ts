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
    const { now, startOfDay } = this.getEffectiveDate(tz)
    
    // Parse schedule time (e.g., '08:30' -> hours: 8, minutes: 30)
    const [schedHour, schedMinute] = scheduleTime.split(':').map(Number)
    
    // Create schedule date in the user's timezone
    const scheduleDate = new Date(startOfDay)
    scheduleDate.setHours(schedHour, schedMinute, 0, 0)
    
    // Calculate late threshold (schedule + tolerance)
    const toleranceMs = toleranceMinutes * 60 * 1000
    const lateThreshold = new Date(scheduleDate.getTime() + toleranceMs)
    
    // Determine status
    return now > lateThreshold ? 'LATE' : 'ON_TIME'
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
