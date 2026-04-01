import { Attendance } from '../entities/Attendance'
import { AttendanceStatusEnum } from '../value-objects/AttendanceStatus'
import type { AttendanceRepositoryInterface } from '../repositories/AttendanceRepository'
import type { TimezoneGateway, UserScheduleGateway } from './CheckInUseCase'

export type AttendanceUiStatus = 'idle' | 'checked-in' | 'checked-out'

export interface CurrentStatusResult {
  status: AttendanceUiStatus
  checkInTime: string | null
  checkOutTime: string | null
  warningMessage: string | null
  attendanceId: string | null
  checkInAt: string | null
  checkOutAt: string | null
  attendanceStatus: AttendanceStatusEnum | null
  workingHourMode: 'FIXED' | 'SHIFT' | 'FLEXIBLE' | null
  flexibleTargetHour: number | null
  shift: {
    startTime: string | null
    endTime: string | null
  } | null
}

export interface GetCurrentStatusUseCaseDependencies {
  attendanceRepo: AttendanceRepositoryInterface
  timezoneGateway: TimezoneGateway
  userScheduleGateway: UserScheduleGateway
}

/**
 * GetCurrentStatusUseCase
 * 
 * Returns the current attendance status for a user:
 * - idle: no session today
 * - checked-in: has active session
 * - checked-out: completed session today
 */
export class GetCurrentStatusUseCase {
  constructor(private deps: GetCurrentStatusUseCaseDependencies) {}

  async execute(userId: string, tenantId?: string): Promise<CurrentStatusResult> {
    const timezone = await this.deps.timezoneGateway.getTimezone(tenantId)
    const nowInTz = this.deps.timezoneGateway.getCurrentTimeInTimezone(timezone)
    const todayStart = this.getStartOfDay(nowInTz, timezone)

    // Find today's attendance (latest)
    const attendance = await this.deps.attendanceRepo.findByUserIdAndDate(userId, todayStart, tenantId)

    if (!attendance) {
      return this.buildIdleStatus(null)
    }

    const schedule = await this.deps.userScheduleGateway.getUserSchedule(userId)

    if (attendance.isCheckedOut()) {
      return {
        status: 'checked-out',
        checkInTime: this.formatTime(attendance.checkIn, timezone),
        checkOutTime: attendance.checkOut ? this.formatTime(attendance.checkOut, timezone) : null,
        warningMessage: null,
        attendanceId: attendance.id,
        checkInAt: attendance.checkIn.toISOString(),
        checkOutAt: attendance.checkOut?.toISOString() ?? null,
        attendanceStatus: attendance.status.value,
        workingHourMode: schedule?.workingHourMode ?? null,
        flexibleTargetHour: null,
        shift: {
          startTime: schedule?.shiftStartTime ?? null,
          endTime: schedule?.shiftEndTime ?? null,
        },
      }
    }

    // Active session
    return {
      status: 'checked-in',
      checkInTime: this.formatTime(attendance.checkIn, timezone),
      checkOutTime: null,
      warningMessage: null,
      attendanceId: attendance.id,
      checkInAt: attendance.checkIn.toISOString(),
      checkOutAt: null,
      attendanceStatus: attendance.status.value,
      workingHourMode: schedule?.workingHourMode ?? null,
      flexibleTargetHour: null,
      shift: {
        startTime: schedule?.shiftStartTime ?? null,
        endTime: schedule?.shiftEndTime ?? null,
      },
    }
  }

  private buildIdleStatus(attendance: Attendance | null): CurrentStatusResult {
    return {
      status: 'idle',
      checkInTime: null,
      checkOutTime: null,
      warningMessage: null,
      attendanceId: attendance?.id ?? null,
      checkInAt: attendance?.checkIn?.toISOString() ?? null,
      checkOutAt: attendance?.checkOut?.toISOString() ?? null,
      attendanceStatus: attendance?.status?.value ?? null,
      workingHourMode: null,
      flexibleTargetHour: null,
      shift: null,
    }
  }

  private formatTime(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  }

  private getStartOfDay(date: Date, _timezone: string): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }
}
