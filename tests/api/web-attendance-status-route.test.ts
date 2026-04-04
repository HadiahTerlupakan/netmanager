import { NextRequest, NextResponse } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prismaMock } from '../setup'
import { getCrossSurfaceAttendanceFixture } from '../fixtures/attendance/crossSurfaceAttendanceFixtures'

vi.mock('@/lib/api', () => ({
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, message = 'OK', status = 200) =>
        NextResponse.json({ success: true, message, data }, { status }),
}))

describe('web attendance status route', () => {
    let getWebAttendanceStatus: (typeof import('@/app/api/attendance/status/route'))['GET']

    beforeAll(async () => {
        vi.useRealTimers()
        ;({ GET: getWebAttendanceStatus } = await import('@/app/api/attendance/status/route'))
    })

    beforeEach(() => {
        vi.useFakeTimers()
        prismaMock.attendance.findFirst.mockResolvedValue(null)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns idle status when the user has no attendance rows', async () => {
        vi.setSystemTime(new Date('2026-03-08T02:24:00.000Z'))

        const response = await getWebAttendanceStatus(
            new NextRequest('http://localhost/api/attendance/status'),
            {
                session: {
                    user: {
                        id: 'user-1',
                    },
                },
            } as never
        )

        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data).toMatchObject({
            status: 'idle',
            sourceAttendanceId: null,
            warningMessage: null,
        })
    })

    it('returns canonical checked-in status for an overnight shift still in progress', async () => {
        const fixture = getCrossSurfaceAttendanceFixture('overnight-shift-still-active')
        expect(fixture).toBeDefined()

        vi.setSystemTime(new Date(fixture!.now))
        prismaMock.attendance.findFirst.mockResolvedValue({
            id: 'attendance-overnight-1',
            checkIn: new Date(fixture!.attendance.checkIn),
            checkOut: null,
            status: fixture!.attendance.status,
            notes: fixture!.attendance.notes ?? null,
            user: {
                workingHourMode: 'SHIFT',
                flexibleTargetHour: null,
                shift: {
                    startTime: '21:00',
                    endTime: '04:00',
                },
            },
        })

        const response = await getWebAttendanceStatus(
            new NextRequest('http://localhost/api/attendance/status'),
            {
                session: {
                    user: {
                        id: 'user-1',
                    },
                },
            } as never
        )

        const body = await response.json()

        expect(body.data).toMatchObject({
            status: 'checked-in',
            sourceAttendanceId: 'attendance-overnight-1',
            checkInTime: '21:00',
            checkOutTime: null,
            warningMessage: null,
        })
    })
})
