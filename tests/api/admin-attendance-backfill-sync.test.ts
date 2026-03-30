import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prismaMock } from '../setup'

const mockFns = vi.hoisted(() => ({
  syncApprovedLeaveToAttendanceRange: vi.fn(),
  syncDayOffAttendanceRange: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiPaginatedWithSummary: (data: unknown, meta: unknown) =>
    NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
}))

vi.mock('@/lib/rbac', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/auth', () => ({
  getUserPermissions: vi.fn().mockResolvedValue([]),
  isSuperAdmin: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/utils/get-timezone', () => ({
  getTimezone: vi.fn().mockResolvedValue('Asia/Jakarta'),
}))

vi.mock('@/modules/attendance/services/LeaveService', () => ({
  LeaveService: class MockLeaveService {
    syncApprovedLeaveToAttendanceRange = mockFns.syncApprovedLeaveToAttendanceRange
  }
}))

vi.mock('@/modules/attendance/services/AbsenceService', () => ({
  AbsenceService: class MockAbsenceService {
    syncDayOffAttendanceRange = mockFns.syncDayOffAttendanceRange
  }
}))

describe('admin attendance route historical status backfill', () => {
  beforeEach(() => {
    mockFns.syncApprovedLeaveToAttendanceRange.mockReset()
    mockFns.syncDayOffAttendanceRange.mockReset()
    mockFns.syncApprovedLeaveToAttendanceRange.mockResolvedValue(undefined)
    mockFns.syncDayOffAttendanceRange.mockResolvedValue(undefined)

    prismaMock.attendance.findMany.mockResolvedValue([])
    prismaMock.attendance.count.mockResolvedValue(0)
    prismaMock.attendance.groupBy.mockResolvedValue([])
  })

  it('backfills leave and day-off attendance rows for the requested date range before reading Data Absensi', async () => {
    const { GET } = await import('@/app/api/admin/attendance/route')

    const response = await GET(
      new NextRequest('http://localhost/api/admin/attendance?page=1&limit=20&startDate=2026-03-01&endDate=2026-03-31'),
      {
        session: {
          user: {
            id: 'admin-1',
            tenantId: 'tenant-1',
          },
        },
      } as never
    )

    expect(response.status).toBe(200)
    expect(mockFns.syncApprovedLeaveToAttendanceRange).toHaveBeenCalledWith(
      new Date('2026-02-28T17:00:00.000Z'),
      new Date('2026-03-31T16:59:59.999Z'),
      'tenant-1',
      undefined
    )
    expect(mockFns.syncDayOffAttendanceRange).toHaveBeenCalledWith(
      new Date('2026-02-28T17:00:00.000Z'),
      new Date('2026-03-31T16:59:59.999Z'),
      'tenant-1',
      undefined
    )
  })
})
