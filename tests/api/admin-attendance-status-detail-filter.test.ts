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

describe('admin attendance status detail filter', () => {
  beforeEach(() => {
    mockFns.syncApprovedLeaveToAttendanceRange.mockReset()
    mockFns.syncDayOffAttendanceRange.mockReset()
    mockFns.syncApprovedLeaveToAttendanceRange.mockResolvedValue(undefined)
    mockFns.syncDayOffAttendanceRange.mockResolvedValue(undefined)
    prismaMock.attendance.findMany.mockResolvedValue([])
    prismaMock.attendance.count.mockResolvedValue(0)
    prismaMock.attendance.groupBy.mockResolvedValue([])
  })

  it('maps CUTI filter to PERMIT rows with CUTI marker', async () => {
    const { GET } = await import('@/app/api/admin/attendance/route')

    await GET(
      new NextRequest('http://localhost/api/admin/attendance?page=1&limit=20&statusDetail=CUTI&startDate=2026-04-01&endDate=2026-04-30'),
      { session: { user: { id: 'admin-1', tenantId: 'tenant-1' } } } as never
    )

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'PERMIT',
        notes: { contains: '(CUTI)' },
      }),
    }))
  })

  it('maps HARI_LIBUR filter to DAY_OFF rows with holiday marker', async () => {
    const { GET } = await import('@/app/api/admin/attendance/route')

    await GET(
      new NextRequest('http://localhost/api/admin/attendance?page=1&limit=20&statusDetail=HARI_LIBUR&startDate=2026-04-01&endDate=2026-04-30'),
      { session: { user: { id: 'admin-1', tenantId: 'tenant-1' } } } as never
    )

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'DAY_OFF',
        notes: { contains: 'Hari Libur (Day Off)' },
      }),
    }))
  })

  it('maps ABSENT filter to true absence rows and excludes historical auto-checkout rows', async () => {
    const { GET } = await import('@/app/api/admin/attendance/route')

    await GET(
      new NextRequest('http://localhost/api/admin/attendance?page=1&limit=20&statusDetail=ABSENT&startDate=2026-04-01&endDate=2026-04-30'),
      { session: { user: { id: 'admin-1', tenantId: 'tenant-1' } } } as never
    )

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({ status: { in: ['ALPHA', 'ABSENT'] } }),
          expect.objectContaining({
            NOT: expect.objectContaining({
              AND: expect.arrayContaining([
                expect.objectContaining({ status: { in: ['ALPHA', 'ABSENT'] } }),
                expect.objectContaining({ checkOut: { not: null } }),
              ]),
            }),
          }),
        ]),
      }),
    }))
  })

  it('maps NO_CHECKOUT filter to real NO_CHECKOUT rows plus historical auto-checkout rows', async () => {
    const { GET } = await import('@/app/api/admin/attendance/route')

    await GET(
      new NextRequest('http://localhost/api/admin/attendance?page=1&limit=20&statusDetail=NO_CHECKOUT&startDate=2026-04-01&endDate=2026-04-30'),
      { session: { user: { id: 'admin-1', tenantId: 'tenant-1' } } } as never
    )

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { status: 'NO_CHECKOUT' },
          expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({ status: { in: ['ALPHA', 'ABSENT'] } }),
              expect.objectContaining({ checkOut: { not: null } }),
            ]),
          }),
        ]),
      }),
    }))
  })
})
