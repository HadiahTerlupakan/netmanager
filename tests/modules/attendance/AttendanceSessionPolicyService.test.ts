import { describe, expect, it } from 'vitest'

import type { AttendanceStatus } from '@prisma/client'

import { getCrossSurfaceAttendanceFixture } from '../../fixtures/attendance/crossSurfaceAttendanceFixtures'

describe('AttendanceSessionPolicyService', () => {
  it('keeps an overnight shift session active before shift end', async () => {
    const fixture = getCrossSurfaceAttendanceFixture('overnight-shift-still-active')
    expect(fixture).toBeDefined()

    const { AttendanceSessionPolicyService } = await import('@/modules/attendance/services/AttendanceSessionPolicyService')
    const service = new AttendanceSessionPolicyService()

    const decision = service.resolve({
      attendance: {
        id: 'att-overnight',
        checkIn: new Date(fixture!.attendance.checkIn),
        checkOut: null,
        status: fixture!.attendance.status as AttendanceStatus,
        user: {
          workingHourMode: 'SHIFT',
          flexibleTargetHour: null,
          shift: {
            startTime: '21:00',
            endTime: '04:00',
          },
        },
      },
      now: new Date(fixture!.now),
    })

    expect(decision).toMatchObject({
      reason: 'overnight-shift-active',
      isOvernightShiftActive: true,
      isStaleFlexibleSession: false,
      shouldAutoCheckout: false,
      autoCheckoutAt: null,
    })
  })

  it('marks stale flexible sessions as stale and auto-checkout eligible after 24 hours', async () => {
    const fixture = getCrossSurfaceAttendanceFixture('stale-flexible-session')
    expect(fixture).toBeDefined()

    const { AttendanceSessionPolicyService } = await import('@/modules/attendance/services/AttendanceSessionPolicyService')
    const service = new AttendanceSessionPolicyService()

    const decision = service.resolve({
      attendance: {
        id: 'att-flex',
        checkIn: new Date(fixture!.attendance.checkIn),
        checkOut: null,
        status: fixture!.attendance.status as AttendanceStatus,
        user: {
          workingHourMode: 'FLEXIBLE',
          flexibleTargetHour: 8,
          shift: null,
        },
      },
      now: new Date(fixture!.now),
    })

    expect(decision).toMatchObject({
      reason: 'stale-flexible-session',
      isOvernightShiftActive: false,
      isStaleFlexibleSession: true,
      shouldAutoCheckout: true,
      nextStatus: fixture!.attendance.status,
    })
    expect(decision.autoCheckoutAt?.toISOString()).toBe('2026-01-24T02:00:00.000Z')
  })
})
