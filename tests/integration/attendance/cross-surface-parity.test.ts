import { describe, expect, it } from 'vitest'

import {
    crossSurfaceAttendanceFixtures,
    getCrossSurfaceAttendanceFixture,
    type CrossSurfaceAttendanceFixture,
    type WorkerWebAttendanceStatus,
} from '../../fixtures/attendance/crossSurfaceAttendanceFixtures'

const requiredFixtureIds = [
    'same-day-open-session',
    'same-day-checked-out-session',
    'overnight-shift-still-active',
    'stale-flexible-session',
    'no-checkout-system-closure',
    'outside-geofence-warn-accepted',
]

function deriveWorkerWebStatus(fixture: CrossSurfaceAttendanceFixture): WorkerWebAttendanceStatus {
    const checkIn = new Date(fixture.attendance.checkIn)

    if (Number.isNaN(checkIn.getTime())) {
        return 'idle'
    }

    const now = new Date(fixture.now)

    if (now.toDateString() !== checkIn.toDateString()) {
        return 'idle'
    }

    return fixture.attendance.checkOut ? 'checked-out' : 'checked-in'
}

describe('attendance cross-surface parity fixtures', () => {
    it('defines the required attendance scenarios for Task 1', () => {
        expect(crossSurfaceAttendanceFixtures.map((fixture) => fixture.id)).toEqual(
            expect.arrayContaining(requiredFixtureIds)
        )
    })

    it.each(requiredFixtureIds)('documents current worker web status for %s', (fixtureId) => {
        const fixture = getCrossSurfaceAttendanceFixture(fixtureId)

        expect(fixture).toBeDefined()
        expect(deriveWorkerWebStatus(fixture!)).toBe(fixture!.expected.workerWebStatus)
    })
})
