import { describe, expect, it } from 'vitest'

import type { AttendanceStatus } from '@prisma/client'

import { getCrossSurfaceAttendanceFixture } from '../../fixtures/attendance/crossSurfaceAttendanceFixtures'

describe('Attendance session policy parity', () => {
  it('exposes one decision object usable by both status consumers and auto-checkout callers', async () => {
    const overnightFixture = getCrossSurfaceAttendanceFixture('overnight-shift-still-active')
    const staleFlexibleFixture = getCrossSurfaceAttendanceFixture('stale-flexible-session')

    expect(overnightFixture).toBeDefined()
    expect(staleFlexibleFixture).toBeDefined()

    const { AttendanceSessionPolicyService } = await import('@/modules/attendance/services/AttendanceSessionPolicyService')
    const service = new AttendanceSessionPolicyService()

    const overnightDecision = service.resolve({
      attendance: {
        id: 'att-overnight',
        checkIn: new Date(overnightFixture!.attendance.checkIn),
        checkOut: null,
        status: overnightFixture!.attendance.status as AttendanceStatus,
        user: {
          workingHourMode: 'SHIFT',
          flexibleTargetHour: null,
          shift: {
            startTime: '21:00',
            endTime: '04:00',
          },
        },
      },
      now: new Date(overnightFixture!.now),
    })

    const staleFlexibleDecision = service.resolve({
      attendance: {
        id: 'att-flex',
        checkIn: new Date(staleFlexibleFixture!.attendance.checkIn),
        checkOut: null,
        status: staleFlexibleFixture!.attendance.status as AttendanceStatus,
        user: {
          workingHourMode: 'FLEXIBLE',
          flexibleTargetHour: 8,
          shift: null,
        },
      },
      now: new Date(staleFlexibleFixture!.now),
    })

    expect(overnightDecision.shouldAutoCheckout).toBe(false)
    expect(overnightDecision.isOvernightShiftActive).toBe(true)

    expect(staleFlexibleDecision.shouldAutoCheckout).toBe(true)
    expect(staleFlexibleDecision.isStaleFlexibleSession).toBe(true)
    expect(staleFlexibleDecision.nextStatus).toBe(staleFlexibleFixture!.attendance.status)
  })
})
