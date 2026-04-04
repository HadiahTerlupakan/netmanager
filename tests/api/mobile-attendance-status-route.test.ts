import { NextRequest, NextResponse } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { prismaMock } from '../setup'
import { cache } from '@/lib/cache'
import { getCrossSurfaceAttendanceFixture } from '../fixtures/attendance/crossSurfaceAttendanceFixtures'

vi.mock('@/lib/api', () => ({
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, message = 'OK', status = 200) =>
        NextResponse.json({ success: true, message, data }, { status }),
}))

vi.mock('@/modules/database', () => ({
    prisma: prismaMock,
}))

describe('mobile attendance status route', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        cache.clear()
        prismaMock.attendance.findFirst.mockResolvedValue(null)
        prismaMock.holiday.findFirst.mockResolvedValue(null)
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

    it('returns idle when the latest attendance was checked out on a previous day', async () => {
        vi.setSystemTime(new Date('2026-03-09T02:24:00.000Z'))
        prismaMock.attendance.findFirst.mockResolvedValue({
            id: 'attendance-closed-yesterday',
            checkIn: new Date('2026-03-08T02:00:00.000Z'),
            checkOut: new Date('2026-03-08T09:30:00.000Z'),
            status: 'ON_TIME',
            notes: null,
            user: {
                workingHourMode: 'FIXED',
                flexibleTargetHour: null,
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
            sourceAttendanceId: 'attendance-closed-yesterday',
            checkInAt: '2026-03-08T02:00:00.000Z',
            checkOutAt: '2026-03-08T09:30:00.000Z',
            attendanceStatus: 'ON_TIME',
        })
    })

    it('does not report yesterday holiday as today during early morning WIB requests', async () => {
        const { GET } = await import('@/app/api/mobile/attendance/status/route')

        prismaMock.holiday.findFirst
            .mockResolvedValueOnce({
                id: 'holiday-yesterday',
                date: new Date('2026-03-18T00:00:00.000Z'),
                description: 'Nyepi',
                tenantId: 'tenant-1',
            })
            .mockResolvedValueOnce(null)

        vi.setSystemTime(new Date('2026-03-18T16:30:00.000Z'))
        const firstResponse = await GET(
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

        const firstBody = await firstResponse.json()

        vi.setSystemTime(new Date('2026-03-18T18:30:00.000Z'))
        const secondResponse = await GET(
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

        const secondBody = await secondResponse.json()

        expect(firstBody.today).toMatchObject({
            isHoliday: true,
            holidayName: 'Nyepi',
        })
        expect(secondBody.today).toMatchObject({
            isHoliday: false,
            holidayName: null,
        })
        expect(prismaMock.holiday.findFirst).toHaveBeenCalledTimes(2)
    })
})
