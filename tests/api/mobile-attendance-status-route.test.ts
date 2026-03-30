import { NextRequest, NextResponse } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { prismaMock } from '../setup'
import { getCrossSurfaceAttendanceFixture } from '../fixtures/attendance/crossSurfaceAttendanceFixtures'

vi.mock('@/lib/api', () => ({
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, message = 'OK', status = 200) =>
        NextResponse.json({ success: true, message, data }, { status }),
}))

vi.mock('@/modules/holidays/repositories/HolidayRepository', () => ({
    HolidayRepository: class {
        isHoliday = vi.fn().mockResolvedValue({ isHoliday: false, holidayName: null })
    },
}))

describe('mobile attendance status route', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        prismaMock.attendance.findFirst.mockResolvedValue(null)
        prismaMock.user.findFirst.mockResolvedValue({
            id: 'user-1',
            workDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
            workingHourMode: 'FLEXIBLE',
        })
        prismaMock.leaveRequest.findFirst.mockResolvedValue(null)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns today metadata together with idle status when no attendance row exists', async () => {
        vi.setSystemTime(new Date('2026-03-08T02:24:00.000Z'))

        const { GET } = await import('@/app/api/mobile/attendance/status/route')

        const response = await GET(
            new NextRequest('http://localhost/api/mobile/attendance/status'),
            {
                session: {
                    user: {
                        id: 'user-1',
                        tenantId: 'tenant-1',
                    },
                },
            } as never
        )

        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data).toMatchObject({
            status: 'idle',
            sourceAttendanceId: null,
        })
        expect(body.today).toMatchObject({
            isHoliday: false,
            holidayName: null,
            isOffDay: false,
            isTukarLiburWorkDay: false,
            isTukarLiburLeaveDay: false,
        })
    })

    it('returns idle status with warning for a stale flexible session', async () => {
        const fixture = getCrossSurfaceAttendanceFixture('stale-flexible-session')
        expect(fixture).toBeDefined()

        vi.setSystemTime(new Date(fixture!.now))
        prismaMock.attendance.findFirst.mockResolvedValue({
            id: 'attendance-flex-1',
            checkIn: new Date(fixture!.attendance.checkIn),
            checkOut: null,
            status: fixture!.attendance.status,
            notes: fixture!.attendance.notes ?? null,
            user: {
                workingHourMode: 'FLEXIBLE',
                flexibleTargetHour: 8,
                shift: null,
            },
        })

        const { GET } = await import('@/app/api/mobile/attendance/status/route')

        const response = await GET(
            new NextRequest('http://localhost/api/mobile/attendance/status'),
            {
                session: {
                    user: {
                        id: 'user-1',
                        tenantId: 'tenant-1',
                    },
                },
            } as never
        )

        const body = await response.json()

        expect(body.data).toMatchObject({
            status: 'idle',
            sourceAttendanceId: 'attendance-flex-1',
            warningMessage: 'Sesi fleksibel lama sejak 23/01/2026 09:00 belum checkout.',
        })
    })
})
