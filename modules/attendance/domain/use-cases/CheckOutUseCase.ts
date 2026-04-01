import { Attendance } from '../entities/Attendance'
import { CheckOutRequest } from '../value-objects/CheckOutRequest'
import type { AttendanceRepositoryInterface } from '../repositories/AttendanceRepository'
import type { GeofenceGateway, UserScheduleGateway, IdempotencyGateway } from './CheckInUseCase'

export interface CheckOutResult {
  success: boolean
  attendance?: Attendance
  warning?: string
  error?: { code: string; message: string }
}

export interface CheckOutUseCaseDependencies {
  attendanceRepo: AttendanceRepositoryInterface
  geofenceGateway: GeofenceGateway
  userScheduleGateway: UserScheduleGateway
  idempotencyGateway?: IdempotencyGateway
}

/**
 * CheckOutUseCase
 * 
 * Orchestrates the check-out business flow:
 * 1. Find active attendance session
 * 2. Validate geofence
 * 3. Calculate flexible work hour warning
 * 4. Update attendance record
 */
export class CheckOutUseCase {
  constructor(private deps: CheckOutUseCaseDependencies) {}

  async execute(request: CheckOutRequest): Promise<CheckOutResult> {
    // 1. Validate input
    const errors = request.validate()
    if (errors.length > 0) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: errors.join(', ') } }
    }

    // 2. Check idempotency
    if (request.idempotencyKey && this.deps.idempotencyGateway) {
      const cached = await this.deps.idempotencyGateway.getReplay(
        request.userId,
        'check-out',
        request.idempotencyKey,
      )
      if (cached) {
        return cached as CheckOutResult
      }
    }

    // 3. Find active session
    const activeAttendance = await this.deps.attendanceRepo.findActiveByUserId(request.userId)
    if (!activeAttendance) {
      return { success: false, error: { code: 'NO_ACTIVE_SESSION', message: 'No active check-in found' } }
    }

    // 4. Calculate flexible warning
    let warning: string | undefined
    const schedule = await this.deps.userScheduleGateway.getUserSchedule(request.userId)
    if (schedule?.workingHourMode === 'FLEXIBLE') {
      warning = this.calculateFlexibleWarning(activeAttendance.checkIn, new Date())
    }

    // 5. Geofence validation
    let checkOutGeofenceStatus = 'UNKNOWN'
    let checkOutGeofenceDistance: number | null = null

    if (request.hasGeoLocation()) {
      const geo = request.coordinate!
      const policy = schedule?.attendanceGeofencePolicy ?? 'WARN'
      const geoCheck = await this.deps.geofenceGateway.validateGeofence(
        request.userId,
        geo.latitude,
        geo.longitude,
      )

      if (!geoCheck.isInside && policy === 'STRICT') {
        return { success: false, error: { code: 'OUTSIDE_GEOFENCE', message: 'You are outside the designated work area' } }
      }

      checkOutGeofenceStatus = geoCheck.isInside ? 'INSIDE' : 'OUTSIDE'
      checkOutGeofenceDistance = geoCheck.nearestDistance
    }

    // 6. Perform check-out
    const checkOutTime = request.getEffectiveTime()
    activeAttendance.checkOutNow(
      checkOutTime,
      request.photoUrl ?? undefined,
      request.location ?? undefined,
      checkOutGeofenceStatus,
      checkOutGeofenceDistance,
      request.notes ?? undefined,
    )

    // 7. Persist
    const updated = await this.deps.attendanceRepo.update(activeAttendance)

    return {
      success: true,
      attendance: updated,
      warning,
    }
  }

  private calculateFlexibleWarning(checkIn: Date, checkOut: Date): string {
    const durationHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
    const targetHours = 8 // Default flexible target

    if (durationHours < targetHours) {
      const workedHours = Math.floor(durationHours)
      const workedMinutes = Math.round((durationHours % 1) * 60)
      const remainingHours = targetHours - durationHours
      const remainingHoursInt = Math.floor(remainingHours)
      const remainingMinutes = Math.round((remainingHours % 1) * 60)

      return `Jam kerja Anda baru ${workedHours} jam ${workedMinutes} menit. Target kerja: ${targetHours} jam. Kurang ${remainingHoursInt} jam ${remainingMinutes} menit.`
    }

    return ''
  }
}
