import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { getCrossSurfaceAttendanceFixture } from '../../fixtures/attendance/crossSurfaceAttendanceFixtures'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { AttendanceValidationService } from '@/modules/attendance/services/AttendanceValidationService'
import { AttendanceTimezoneService } from '@/modules/attendance/services/AttendanceTimezoneService'
import { GeofenceService } from '@/modules/attendance/services/GeofenceService'

// Mock LeaveRepository - correct path
vi.mock('@/modules/attendance/repositories/LeaveRepository', () => ({
  LeaveRepository: class MockLeaveRepository {
    getUserLeaveStats = vi.fn().mockResolvedValue([])
  }
}))

// Mock OvertimeRepository with class syntax
vi.mock('@/modules/overtime/repositories/OvertimeRepository', () => ({
  OvertimeRepository: class MockOvertimeRepository {
    getUserOvertimeStats = vi.fn().mockResolvedValue([])
  }
}))

// Mock AttendanceRepository with class syntax - matching actual return structure
vi.mock('@/modules/attendance/repositories/AttendanceRepository', () => ({
  AttendanceRepository: class MockAttendanceRepository {
    getStatsByDateRange = vi.fn().mockResolvedValue({
      total: 100,
      avgDurationMinutes: 480,
      statusCounts: { ON_TIME: 80, LATE: 15, ABSENT: 5 }
    })
    getDailyStats = vi.fn().mockResolvedValue([])
    getGroupedStats = vi.fn().mockResolvedValue([])
    getTopEmployees = vi.fn().mockResolvedValue([])
    getUserAttendanceStats = vi.fn().mockResolvedValue([])
    getTopAbsentees = vi.fn().mockResolvedValue([])
    getUserTotalDuration = vi.fn().mockResolvedValue(new Map())
    getUserAbsenceStats = vi.fn().mockResolvedValue([])
    getUserLateStats = vi.fn().mockResolvedValue([])
  }
}))

describe('AttendanceService', () => {
  let service: AttendanceService
  const now = new Date('2026-03-08T08:00:00.000Z')
  const startOfDay = new Date('2026-03-08T00:00:00.000Z')

  beforeEach(() => {
    service = new AttendanceService()
    // Mock prisma.user.findMany for user details
    prismaMock.user.findMany.mockResolvedValue([])
    vi.spyOn(AttendanceValidationService.prototype, 'validateCheckInEligibility').mockResolvedValue({ isValid: true })
    vi.spyOn(AttendanceTimezoneService.prototype, 'getTimezone').mockResolvedValue('Asia/Jakarta')
    vi.spyOn(AttendanceTimezoneService.prototype, 'getEffectiveDate').mockReturnValue({
      now,
      startOfDay,
      tzOffsetMs: 0,
    })
    vi.spyOn(AttendanceTimezoneService.prototype, 'calculateStatus').mockResolvedValue('ON_TIME')
  })

  describe('getReportData', () => {
    it('should return correct report structure', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await service.getReportData(startDate, endDate)

      // Check actual return structure based on implementation
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('trends')
      expect(result).toHaveProperty('bySite')
      expect(result).toHaveProperty('byDepartment')
      expect(result).toHaveProperty('topEmployees')
      expect(result).toHaveProperty('combinedTopEmployees')
      expect(result).toHaveProperty('topAbsentees')
      expect(result).toHaveProperty('employeeSummary')
    })

    it('should calculate summary statistics correctly', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await service.getReportData(startDate, endDate)

      // Check summary structure
      expect(result.summary).toHaveProperty('totalAttendance')
      expect(result.summary).toHaveProperty('lateCount')
      expect(result.summary).toHaveProperty('lateRate')
      expect(result.summary).toHaveProperty('alphaCount')
      expect(result.summary).toHaveProperty('alphaRate')
      expect(result.summary.totalAttendance).toBe(100)
    })

    it('should calculate late rate correctly', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await service.getReportData(startDate, endDate)

      // Check late rate is calculated (value depends on mock data)
      expect(result.summary).toHaveProperty('lateRate')
      expect(typeof result.summary.lateRate).toBe('number')
    })
  })

  describe('geofence policy enforcement', () => {
    it('rejects check-in for strict users outside the geofence', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        startWorkTime: '08:00',
        endWorkTime: '17:00',
        workingHourMode: 'FIXED',
        shiftId: null,
        attendanceGeofencePolicy: 'STRICT',
        shift: null,
      })
      prismaMock.attendance.findMany.mockResolvedValueOnce([])
      prismaMock.attendance.findFirst.mockResolvedValueOnce(null)

      vi.spyOn(GeofenceService.prototype, 'validateGeofence').mockResolvedValueOnce({
        isInside: false,
        nearestDistance: 250,
        nearestSiteName: 'Kantor Pusat',
        nearestSiteId: 'site-1',
      })

      await expect(service.checkIn({
        userId: 'strict-user',
        photoUrl: null,
        location: 'Remote',
        notes: '',
        latitude: -6.2,
        longitude: 106.8,
      })).rejects.toThrow('OUTSIDE_GEOFENCE')
    })

    it('allows check-in for warn users outside the geofence and stores outside metadata', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        startWorkTime: '08:00',
        endWorkTime: '17:00',
        workingHourMode: 'FIXED',
        shiftId: null,
        attendanceGeofencePolicy: 'WARN',
        shift: null,
      })
      prismaMock.attendance.findMany.mockResolvedValueOnce([])
      prismaMock.attendance.findFirst.mockResolvedValueOnce(null)

      vi.spyOn(GeofenceService.prototype, 'validateGeofence').mockResolvedValueOnce({
        isInside: false,
        nearestDistance: 150,
        nearestSiteName: 'Site Hybrid',
        nearestSiteId: 'site-2',
      })

      prismaMock.attendance.create.mockResolvedValueOnce({
        id: 'att-1',
        userId: 'warn-user',
        geofenceStatus: 'OUTSIDE',
        geofenceDistance: 150,
        geofenceSiteName: 'Site Hybrid',
      })

      const result = await service.checkIn({
        userId: 'warn-user',
        photoUrl: null,
        location: 'Client site',
        notes: '',
        latitude: -6.21,
        longitude: 106.81,
      })

      expect(prismaMock.attendance.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          geofenceStatus: 'OUTSIDE',
          geofenceDistance: 150,
          geofenceSiteName: 'Site Hybrid',
        }),
      }))
      expect(result).toMatchObject({
        geofenceStatus: 'OUTSIDE',
        geofenceDistance: 150,
        geofenceSiteName: 'Site Hybrid',
      })
    })

    it('rejects check-out for strict users outside the geofence', async () => {
      prismaMock.attendance.findFirst.mockResolvedValueOnce({
        id: 'att-2',
        userId: 'strict-user',
        checkIn: new Date('2026-03-08T01:00:00.000Z'),
        checkOut: null,
        notes: 'Masuk tepat waktu',
        user: {
          workingHourMode: 'FIXED',
          flexibleTargetHour: null,
          name: 'Strict User',
          attendanceGeofencePolicy: 'STRICT',
        },
      })

      vi.spyOn(GeofenceService.prototype, 'validateGeofence').mockResolvedValueOnce({
        isInside: false,
        nearestDistance: 400,
        nearestSiteName: 'HQ',
        nearestSiteId: 'site-1',
      })

      await expect(service.checkOut({
        userId: 'strict-user',
        photoUrl: null,
        location: 'Rumah',
        latitude: -6.22,
        longitude: 106.82,
      })).rejects.toThrow('OUTSIDE_GEOFENCE')
    })

    it('rejects a new check-in when a flexible session from yesterday is still active', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        startWorkTime: '08:00',
        endWorkTime: '17:00',
        workingHourMode: 'FLEXIBLE',
        shiftId: null,
        attendanceGeofencePolicy: 'WARN',
        shift: null,
      })

      prismaMock.attendance.findFirst.mockResolvedValueOnce({
        id: 'att-flex-active',
        checkIn: new Date('2026-03-07T10:00:00.000Z'),
        checkOut: null,
        status: 'ON_TIME',
        user: {
          workingHourMode: 'FLEXIBLE',
          flexibleTargetHour: 8,
          shift: null,
        },
      })

      await expect(service.checkIn({
        userId: 'flex-user',
        photoUrl: null,
        location: 'Remote',
        notes: '',
        latitude: -6.2,
        longitude: 106.8,
      })).rejects.toThrow('DUPLICATE_ENTRY')
    })

    it('rejects a new check-in when an overnight shift session is still active after midnight', async () => {
      vi.spyOn(AttendanceTimezoneService.prototype, 'getEffectiveDate').mockReturnValueOnce({
        now: new Date('2026-03-07T18:00:00.000Z'),
        startOfDay: new Date('2026-03-07T00:00:00.000Z'),
        tzOffsetMs: 0,
      })

      prismaMock.user.findUnique.mockResolvedValueOnce({
        startWorkTime: '08:00',
        endWorkTime: '17:00',
        workingHourMode: 'SHIFT',
        shiftId: 'shift-1',
        attendanceGeofencePolicy: 'WARN',
        shift: {
          startTime: '21:00',
          endTime: '04:00',
        },
      })
      prismaMock.attendance.findMany.mockResolvedValueOnce([])
      prismaMock.attendance.findFirst.mockResolvedValueOnce({
        id: 'att-shift-overnight',
        checkIn: new Date('2026-03-07T15:00:00.000Z'),
        checkOut: null,
        status: 'ON_TIME',
        user: {
          workingHourMode: 'SHIFT',
          flexibleTargetHour: null,
          shift: {
            startTime: '21:00',
            endTime: '04:00',
          },
        },
      })

      await expect(service.checkIn({
        userId: 'shift-user',
        photoUrl: null,
        location: 'Remote',
        notes: '',
        latitude: -6.2,
        longitude: 106.8,
      })).rejects.toThrow('DUPLICATE_ENTRY')
    })
  })

})

describe('AttendanceService cross-surface fixture coverage', () => {
  it('exposes critical attendance fixtures needed by parity tests', () => {
    expect(getCrossSurfaceAttendanceFixture('same-day-open-session')).toBeDefined()
    expect(getCrossSurfaceAttendanceFixture('same-day-checked-out-session')).toBeDefined()
    expect(getCrossSurfaceAttendanceFixture('overnight-shift-still-active')).toBeDefined()
    expect(getCrossSurfaceAttendanceFixture('stale-flexible-session')).toBeDefined()
    expect(getCrossSurfaceAttendanceFixture('no-checkout-system-closure')).toBeDefined()
    expect(getCrossSurfaceAttendanceFixture('outside-geofence-warn-accepted')).toBeDefined()
  })
})
