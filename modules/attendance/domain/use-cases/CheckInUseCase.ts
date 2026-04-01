import { Attendance } from '../entities/Attendance'
import { AttendanceStatus } from '../value-objects/AttendanceStatus'
import { CheckInRequest } from '../value-objects/CheckInRequest'
import type { AttendanceRepositoryInterface } from '../repositories/AttendanceRepository'
import type { HolidayRepositoryInterface } from '../repositories/HolidayRepository'
import type { LeaveRepositoryInterface } from '../repositories/LeaveRepository'

// ---- Output DTOs (pure, no framework deps) ----
export interface CheckInResult {
  success: boolean
  attendance?: Attendance
  error?: CheckInError
}

export interface CheckInError {
  code: string
  message: string
}

// ---- Gateway interfaces for external services ----
// These abstract away Redis, geofence, timezone services etc.
export interface GeofenceGateway {
  validateGeofence(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ isInside: boolean; nearestDistance: number | null; nearestSiteName: string | null }>
  getPolicyForUser(userId: string): Promise<'STRICT' | 'WARN' | 'DISABLED'>
}

export interface TimezoneGateway {
  getTimezone(tenantId?: string): Promise<string>
  getCurrentTimeInTimezone(timezone: string): Date
  calculateStatus(
    checkInTime: Date,
    scheduleTimeHHmm: string,
    timezone: string,
  ): Promise<'ON_TIME' | 'LATE'>
}

export interface UserScheduleGateway {
  getUserSchedule(userId: string): Promise<{
    startWorkTime: string | null
    endWorkTime: string | null
    workingHourMode: 'FIXED' | 'SHIFT' | 'FLEXIBLE' | null
    attendanceGeofencePolicy: 'STRICT' | 'WARN' | 'DISABLED' | null
    shiftStartTime: string | null
    shiftEndTime: string | null
  } | null>
}

export interface IdempotencyGateway {
  begin(userId: string, action: string, requestId: string, hash: string): Promise<'started' | 'in-progress' | 'completed' | 'hash-mismatch'>
  complete(userId: string, action: string, requestId: string, hash: string, response: unknown): Promise<void>
  getReplay(userId: string, action: string, requestId: string): Promise<unknown | null>
  release(userId: string, action: string, requestId: string): Promise<void>
}

// ---- Dependencies injection interface ----
export interface CheckInUseCaseDependencies {
  attendanceRepo: AttendanceRepositoryInterface
  holidayRepo: HolidayRepositoryInterface
  leaveRepo: LeaveRepositoryInterface
  geofenceGateway: GeofenceGateway
  timezoneGateway: TimezoneGateway
  userScheduleGateway: UserScheduleGateway
  idempotencyGateway?: IdempotencyGateway
}

/**
 * CheckInUseCase
 * 
 * Orchestrates the check-in business flow:
 * 1. Validate eligibility (holiday, leave, off-day)
 * 2. Load user schedule settings
 * 3. Resolve active session conflicts (auto-checkout stale sessions)
 * 4. Validate geofence
 * 5. Determine status (ON_TIME vs LATE)
 * 6. Persist attendance record
 * 
 * This use case depends ONLY on domain abstractions.
 */
export class CheckInUseCase {
  constructor(private deps: CheckInUseCaseDependencies) {}

  async execute(request: CheckInRequest): Promise<CheckInResult> {
    // 1. Validate input
    const validationErrors = request.validate()
    if (validationErrors.length > 0) {
      return this.fail('VALIDATION_ERROR', validationErrors.join(', '))
    }

    // 2. Check idempotency (if key provided)
    if (request.idempotencyKey && this.deps.idempotencyGateway) {
      const cached = await this.deps.idempotencyGateway.getReplay(
        request.userId,
        'check-in',
        request.idempotencyKey,
      )
      if (cached) {
        return cached as CheckInResult
      }
    }

    // 3. Timezone resolution
    const timezone = request.timezone
    const checkInTime = request.getEffectiveTime()
    const todayDate = this.getStartOfDay(checkInTime, timezone)

    // 4. Validate check-in eligibility
    const eligibility = await this.validateEligibility(request.userId, checkInTime, timezone, request.tenantId)
    if (!eligibility.isValid) {
      return this.fail(eligibility.code, eligibility.reason)
    }

    // 5. Load user schedule
    const schedule = await this.deps.userScheduleGateway.getUserSchedule(request.userId)
    if (!schedule) {
      return this.fail('USER_NOT_FOUND', 'User schedule not found')
    }

    // 6. Check for active session conflicts
    const conflictResult = await this.resolveActiveSessionConflict(
      request.userId,
      schedule,
      checkInTime,
    )
    if (!conflictResult.canProceed) {
      return this.fail('DUPLICATE_ENTRY', 'You already have an active check-in session')
    }

    // 7. Geofence validation
    let geofenceResult = {
      status: 'UNKNOWN' as string,
      distance: null as number | null,
      siteName: null as string | null,
    }

    if (request.hasGeoLocation()) {
      const geo = request.coordinate!
      const policy = schedule.attendanceGeofencePolicy ?? 'WARN'
      const geoCheck = await this.deps.geofenceGateway.validateGeofence(
        request.userId,
        geo.latitude,
        geo.longitude,
      )

      if (!geoCheck.isInside && policy === 'STRICT') {
        return this.fail('OUTSIDE_GEOFENCE', 'You are outside the designated work area')
      }

      geofenceResult = {
        status: geoCheck.isInside ? 'INSIDE' : 'OUTSIDE',
        distance: geoCheck.nearestDistance,
        siteName: geoCheck.nearestSiteName,
      }
    }

    // 8. Determine attendance status
    const status = await this.determineStatus(
      checkInTime,
      schedule,
      timezone,
    )

    // 9. Create attendance entity
    const attendanceId = this.generateId()
    const attendance = new Attendance({
      id: attendanceId,
      userId: request.userId,
      checkIn: checkInTime,
      checkInDate: todayDate,
      checkOut: null,
      checkInPhoto: request.photoUrl ?? null,
      checkOutPhoto: null,
      status: AttendanceStatus.fromString(status),
      notes: request.notes ?? null,
      location: request.location ?? null,
      checkOutLocation: null,
      geofenceStatus: geofenceResult.status,
      geofenceDistance: geofenceResult.distance,
      geofenceSiteName: geofenceResult.siteName,
      checkOutGeofenceStatus: null,
      checkOutGeofenceDistance: null,
      geofenceMeta: request.offlineTime ? { offline: true, capturedAt: request.offlineTime.toISOString() } : null,
      tenantId: request.tenantId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 10. Persist
    try {
      const saved = await this.deps.attendanceRepo.save(attendance)
      return { success: true, attendance: saved }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        return this.fail('DUPLICATE_ENTRY', 'You have already checked in today')
      }
      throw error
    }
  }

  // ---- Private helper methods ----

  private async validateEligibility(
    userId: string,
    date: Date,
    timezone: string,
    tenantId?: string,
  ): Promise<{ isValid: boolean; code: string; reason: string }> {
    // Check holiday (scoped to tenant for multi-tenancy safety)
    const isHoliday = await this.deps.holidayRepo.isHoliday(date, tenantId)
    if (isHoliday) {
      return { isValid: false, code: 'CHECKIN_REJECTED', reason: 'Today is a holiday' }
    }

    // Check approved leave (scoped to tenant)
    const hasLeave = await this.deps.leaveRepo.hasApprovedLeaveOnDate(userId, date, tenantId)
    if (hasLeave) {
      return { isValid: false, code: 'CHECKIN_REJECTED', reason: 'You have an approved leave for today' }
    }

    // Check off-day (simplified - uses day of week)
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0) {
      // Sunday - basic off-day check
      // In full implementation, this would check user's workDays config
      // For now, skip this check as it requires user schedule context
    }

    return { isValid: true, code: '', reason: '' }
  }

  private async resolveActiveSessionConflict(
    userId: string,
    schedule: { workingHourMode: 'FIXED' | 'SHIFT' | 'FLEXIBLE' | null; shiftEndTime: string | null; endWorkTime: string | null },
    atTime: Date,
  ): Promise<{ canProceed: boolean }> {
    const activeSession = await this.deps.attendanceRepo.findActiveByUserId(userId)

    if (!activeSession) {
      return { canProceed: true }
    }

    // If FLEXIBLE mode, check if session is stale (>24h)
    if (schedule.workingHourMode === 'FLEXIBLE') {
      const hoursSinceCheckIn = (atTime.getTime() - activeSession.checkIn.getTime()) / (1000 * 60 * 60)
      if (hoursSinceCheckIn > 24) {
        // Auto-checkout stale flexible session
        activeSession.markNoCheckout(atTime)
        await this.deps.attendanceRepo.update(activeSession)
        return { canProceed: true }
      }
      return { canProceed: false }
    }

    // For FIXED/SHIFT: check if past schedule end time
    const scheduleEndTime = schedule.workingHourMode === 'SHIFT'
      ? schedule.shiftEndTime
      : schedule.endWorkTime

    if (scheduleEndTime) {
      const [endHour, endMinute] = scheduleEndTime.split(':').map(Number)
      const scheduleEnd = new Date(atTime)
      scheduleEnd.setHours(endHour, endMinute, 0, 0)

      if (atTime > scheduleEnd) {
        // Session is past schedule - auto-checkout
        activeSession.markNoCheckout(scheduleEnd)
        await this.deps.attendanceRepo.update(activeSession)
        return { canProceed: true }
      }
    }

    return { canProceed: false }
  }

  private async determineStatus(
    checkInTime: Date,
    schedule: { startWorkTime: string | null; workingHourMode: 'FIXED' | 'SHIFT' | 'FLEXIBLE' | null; shiftStartTime: string | null },
    timezone: string,
  ): Promise<string> {
    if (schedule.workingHourMode === 'FLEXIBLE') {
      return 'ON_TIME'
    }

    const scheduleTime = schedule.workingHourMode === 'SHIFT'
      ? schedule.shiftStartTime
      : schedule.startWorkTime

    if (!scheduleTime) {
      return 'ON_TIME'
    }

    return await this.deps.timezoneGateway.calculateStatus(checkInTime, scheduleTime, timezone)
  }

  private getStartOfDay(date: Date, _timezone: string): Date {
    // Simplified: use local date
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  private fail(code: string, message: string): CheckInResult {
    return { success: false, error: { code, message } }
  }
}
