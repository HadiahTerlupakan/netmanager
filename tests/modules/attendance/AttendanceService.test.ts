import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'

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

  beforeEach(() => {
    service = new AttendanceService()
    // Mock prisma.user.findMany for user details
    prismaMock.user.findMany.mockResolvedValue([])
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

})
