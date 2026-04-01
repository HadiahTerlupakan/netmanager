import { redis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { AttendanceTimezoneService } from '../services/AttendanceTimezoneService'
import { GeofenceService } from '../services/GeofenceService'

import {
  PrismaAttendanceRepository,
  PrismaHolidayRepository,
  PrismaLeaveRepository,
  PrismaLeaveBalanceRepository,
} from '../infrastructure/repositories'

import type {
  CheckInUseCaseDependencies,
  CheckOutUseCaseDependencies,
  GetCurrentStatusUseCaseDependencies,
  GeofenceGateway,
  TimezoneGateway,
  UserScheduleGateway,
  IdempotencyGateway,
} from '../domain'
import { CheckInUseCase, CheckOutUseCase, GetCurrentStatusUseCase } from '../domain'
import { AttendanceIdempotencyService } from '../services/AttendanceIdempotencyService'

// ---- Gateway Adapters ----
// These bridge existing services to the gateway interfaces expected by use cases.

class GeofenceGatewayAdapter implements GeofenceGateway {
  private geofenceService = new GeofenceService()

  async validateGeofence(userId: string, latitude: number, longitude: number) {
    const result = await this.geofenceService.validateGeofence(userId, latitude, longitude)
    return {
      isInside: result.isInside,
      nearestDistance: result.nearestDistance,
      nearestSiteName: result.nearestSiteName,
    }
  }

  async getPolicyForUser(userId: string): Promise<'STRICT' | 'WARN' | 'DISABLED'> {
    const policy = await this.geofenceService.getPolicyForUser(userId)
    return (policy as 'STRICT' | 'WARN' | 'DISABLED') ?? 'WARN'
  }
}

class TimezoneGatewayAdapter implements TimezoneGateway {
  private timezoneService = new AttendanceTimezoneService()

  async getTimezone(tenantId?: string): Promise<string> {
    return this.timezoneService.getTimezone(tenantId)
  }

  getCurrentTimeInTimezone(timezone: string): Date {
    return this.timezoneService.getEffectiveDate(timezone).now
  }

  async calculateStatus(
    checkInTime: Date,
    scheduleTimeHHmm: string,
    timezone: string,
  ): Promise<'ON_TIME' | 'LATE'> {
    const status = await this.timezoneService.calculateStatus(checkInTime, scheduleTimeHHmm, timezone)
    return status as 'ON_TIME' | 'LATE'
  }
}

class UserScheduleGatewayAdapter implements UserScheduleGateway {
  async getUserSchedule(userId: string) {
    const cacheKey = `user:schedule:${userId}`
    const cachedRaw = await redis.get(cacheKey)

    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw)
      return {
        startWorkTime: cached.startWorkTime ?? null,
        endWorkTime: cached.endWorkTime ?? null,
        workingHourMode: cached.workingHourMode ?? null,
        attendanceGeofencePolicy: cached.attendanceGeofencePolicy ?? null,
        shiftStartTime: cached.shift?.startTime ?? null,
        shiftEndTime: cached.shift?.endTime ?? null,
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        startWorkTime: true,
        endWorkTime: true,
        workingHourMode: true,
        attendanceGeofencePolicy: true,
        shift: { select: { startTime: true, endTime: true } },
      },
    })

    if (!user) return null

    // Cache for 60 seconds
    await redis.setex(cacheKey, 60, JSON.stringify(user))

    return {
      startWorkTime: user.startWorkTime,
      endWorkTime: user.endWorkTime,
      workingHourMode: user.workingHourMode as 'FIXED' | 'SHIFT' | 'FLEXIBLE' | null,
      attendanceGeofencePolicy: user.attendanceGeofencePolicy as 'STRICT' | 'WARN' | 'DISABLED' | null,
      shiftStartTime: user.shift?.startTime ?? null,
      shiftEndTime: user.shift?.endTime ?? null,
    }
  }
}

class IdempotencyGatewayAdapter implements IdempotencyGateway {
  private service = new AttendanceIdempotencyService()

  async begin(userId: string, action: string, requestId: string, hash: string) {
    return this.service.begin(userId, action, requestId, hash)
  }

  async complete(userId: string, action: string, requestId: string, hash: string, response: unknown) {
    return this.service.complete(userId, action, requestId, hash, response)
  }

  async getReplay(userId: string, action: string, requestId: string) {
    return this.service.getReplay(userId, action, requestId)
  }

  async release(userId: string, action: string, requestId: string) {
    return this.service.release(userId, action, requestId)
  }
}

// ---- Container ----
/**
 * Dependency Injection Container for Attendance module.
 *
 * Wires together:
 * - Repository implementations (Prisma-based)
 * - Gateway adapters (bridge existing services to domain interfaces)
 * - Use cases
 *
 * Usage:
 *   const container = new AttendanceContainer()
 *   const result = await container.checkInUseCase.execute(request)
 */
export class AttendanceContainer {
  // Repositories
  readonly attendanceRepo = new PrismaAttendanceRepository()
  readonly holidayRepo = new PrismaHolidayRepository()
  readonly leaveRepo = new PrismaLeaveRepository()
  readonly leaveBalanceRepo = new PrismaLeaveBalanceRepository()

  // Gateway Adapters
  readonly geofenceGateway = new GeofenceGatewayAdapter()
  readonly timezoneGateway = new TimezoneGatewayAdapter()
  readonly userScheduleGateway = new UserScheduleGatewayAdapter()
  readonly idempotencyGateway = new IdempotencyGatewayAdapter()

  // Use Cases (direct instantiation)
  readonly checkInUseCase = new CheckInUseCase(this.checkInDependencies)
  readonly checkOutUseCase = new CheckOutUseCase(this.checkOutDependencies)
  readonly getCurrentStatusUseCase = new GetCurrentStatusUseCase(this.currentStatusDependencies)

  // Dependency bundles
  get checkInDependencies(): CheckInUseCaseDependencies {
    return {
      attendanceRepo: this.attendanceRepo,
      holidayRepo: this.holidayRepo,
      leaveRepo: this.leaveRepo,
      geofenceGateway: this.geofenceGateway,
      timezoneGateway: this.timezoneGateway,
      userScheduleGateway: this.userScheduleGateway,
      idempotencyGateway: this.idempotencyGateway,
    }
  }

  get checkOutDependencies(): CheckOutUseCaseDependencies {
    return {
      attendanceRepo: this.attendanceRepo,
      geofenceGateway: this.geofenceGateway,
      userScheduleGateway: this.userScheduleGateway,
      idempotencyGateway: this.idempotencyGateway,
    }
  }

  get currentStatusDependencies(): GetCurrentStatusUseCaseDependencies {
    return {
      attendanceRepo: this.attendanceRepo,
      timezoneGateway: this.timezoneGateway,
      userScheduleGateway: this.userScheduleGateway,
    }
  }
}

// Singleton instance
let _container: AttendanceContainer | null = null

export function getAttendanceContainer(): AttendanceContainer {
  if (!_container) {
    _container = new AttendanceContainer()
  }
  return _container
}
