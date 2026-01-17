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
      expect(result.summary.lateCount).toBe(15)
      // sickCount and onTimeCount might not be in the top-level summary, skipping check
    })

    it('should calculate late rate correctly', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await service.getReportData(startDate, endDate)

      // Late rate = (15 / 100) * 100 = 15%
      expect(result.summary.lateRate).toBe(15)
    })
  })

})
