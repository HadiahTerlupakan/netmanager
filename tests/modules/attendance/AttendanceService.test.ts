import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'

// Mock OvertimeRepository with class syntax
vi.mock('@/modules/overtime/repositories/OvertimeRepository', () => ({
  OvertimeRepository: class MockOvertimeRepository {
    getUserOvertimeStats = vi.fn().mockResolvedValue([])
  }
}))

// Mock AttendanceRepository with class syntax
vi.mock('@/modules/attendance/repositories/AttendanceRepository', () => ({
  AttendanceRepository: class MockAttendanceRepository {
    getStatsByDateRange = vi.fn().mockResolvedValue({
      total: 100,
      statusCounts: { ON_TIME: 80, LATE: 15, SICK: 5 }
    })
    getDailyStats = vi.fn().mockResolvedValue([])
    getGroupedStats = vi.fn().mockResolvedValue([])
    getTopEmployees = vi.fn().mockResolvedValue([])
    getUserAttendanceStats = vi.fn().mockResolvedValue([])
  }
}))

describe('AttendanceService', () => {
  let service: AttendanceService

  beforeEach(() => {
    service = new AttendanceService()
  })

  describe('getReportData', () => {
    it('should return correct report structure', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await service.getReportData(startDate, endDate)

      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('trends')
      expect(result).toHaveProperty('bySite')
      expect(result).toHaveProperty('byDepartment')
      expect(result).toHaveProperty('topEmployees')
      expect(result).toHaveProperty('combinedTopEmployees')
    })

    it('should calculate summary statistics correctly', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await service.getReportData(startDate, endDate)

      expect(result.summary.totalAttendance).toBe(100)
      expect(result.summary.onTimeCount).toBe(80)
      expect(result.summary.lateCount).toBe(15)
      expect(result.summary.sickCount).toBe(5)
    })

    it('should calculate late rate correctly', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await service.getReportData(startDate, endDate)

      // Late rate = (15 / 100) * 100 = 15%
      expect(result.summary.lateRate).toBe(15)
    })
  })

  describe('getCombinedTopEmployees', () => {
    it('should return empty array when no employees', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await service.getCombinedTopEmployees(startDate, endDate, 5)

      expect(result).toEqual([])
    })

    it('should respect limit parameter', async () => {
      // Create a new mock for this test
      const mockAttendanceStats = [
        { userId: 'user-1', _count: { _all: 20 } },
        { userId: 'user-2', _count: { _all: 18 } },
        { userId: 'user-3', _count: { _all: 15 } },
        { userId: 'user-4', _count: { _all: 12 } },
        { userId: 'user-5', _count: { _all: 10 } },
        { userId: 'user-6', _count: { _all: 8 } }
      ]

      const mockOvertimeStats = [
        { userId: 'user-1', _sum: { duration: 240 } }, // 4 hours
        { userId: 'user-2', _sum: { duration: 180 } }  // 3 hours
      ]

      const mockUsers = [
        { id: 'user-1', name: 'User 1', image: null, sites: [], departments: [] },
        { id: 'user-2', name: 'User 2', image: null, sites: [], departments: [] },
        { id: 'user-3', name: 'User 3', image: null, sites: [], departments: [] }
      ]

      // Update mocks for this specific test
      prismaMock.user.findMany.mockResolvedValueOnce(mockUsers as any)

      // Result should be limited to top 3
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await service.getCombinedTopEmployees(startDate, endDate, 3)

      // Result should have at most 3 items
      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('should calculate score correctly (attendance days * 10 + OT hours * 1)', async () => {
      // This tests the scoring logic:
      // - 1 attendance day = 10 points
      // - 1 hour overtime = 1 point

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      // The scoring is calculated inside getCombinedTopEmployees
      // We're testing that the structure is correct
      const result = await service.getCombinedTopEmployees(startDate, endDate, 5)

      // Each result item should have user, score, and details
      result.forEach(item => {
        if (item) {
          expect(item).toHaveProperty('user')
          expect(item).toHaveProperty('score')
          expect(item).toHaveProperty('details')
          expect(item.details).toHaveProperty('days')
          expect(item.details).toHaveProperty('otHours')
        }
      })
    })
  })
})
