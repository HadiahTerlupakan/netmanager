export type WorkerWebAttendanceStatus = 'idle' | 'checked-in' | 'checked-out'

export type CrossSurfaceAttendanceFixture = {
    id: string
    attendance: {
        checkIn: string
        checkOut?: string | null
        status: string
        notes?: string | null
        sessionMeta?: {
            isStaleFlexibleSession?: boolean
        }
        user?: {
            workingHourMode?: 'FIXED' | 'SHIFT' | 'FLEXIBLE'
            flexibleTargetHour?: number | null
            shift?: {
                startTime?: string | null
                endTime?: string | null
            } | null
        }
    }
    now: string
    expected: {
        workerWebStatus: WorkerWebAttendanceStatus
        adminExportLabel: string
    }
}

export const crossSurfaceAttendanceFixtures: CrossSurfaceAttendanceFixture[] = [
    {
        id: 'same-day-open-session',
        attendance: {
            checkIn: '2026-03-08T02:00:00.000Z',
            checkOut: null,
            status: 'ON_TIME',
            notes: null,
            user: {
                workingHourMode: 'FIXED',
            },
        },
        now: '2026-03-08T02:24:00.000Z',
        expected: {
            workerWebStatus: 'checked-in',
            adminExportLabel: 'TEPAT WAKTU',
        },
    },
    {
        id: 'same-day-checked-out-session',
        attendance: {
            checkIn: '2026-03-08T02:00:00.000Z',
            checkOut: '2026-03-08T09:30:00.000Z',
            status: 'ON_TIME',
            notes: null,
            user: {
                workingHourMode: 'FIXED',
            },
        },
        now: '2026-03-08T10:00:00.000Z',
        expected: {
            workerWebStatus: 'checked-out',
            adminExportLabel: 'TEPAT WAKTU',
        },
    },
    {
        id: 'overnight-shift-still-active',
        attendance: {
            checkIn: '2026-03-07T14:00:00.000Z',
            checkOut: null,
            status: 'ON_TIME',
            notes: null,
            user: {
                workingHourMode: 'SHIFT',
                shift: {
                    startTime: '21:00',
                    endTime: '04:00',
                },
            },
        },
        now: '2026-03-07T19:24:00.000Z',
        expected: {
            workerWebStatus: 'idle',
            adminExportLabel: 'TEPAT WAKTU',
        },
    },
    {
        id: 'stale-flexible-session',
        attendance: {
            checkIn: '2026-01-23T02:00:00.000Z',
            checkOut: null,
            status: 'ON_TIME',
            notes: null,
            sessionMeta: {
                isStaleFlexibleSession: true,
            },
            user: {
                workingHourMode: 'FLEXIBLE',
                flexibleTargetHour: 8,
            },
        },
        now: '2026-01-24T03:00:00.000Z',
        expected: {
            workerWebStatus: 'idle',
            adminExportLabel: 'TEPAT WAKTU',
        },
    },
    {
        id: 'no-checkout-system-closure',
        attendance: {
            checkIn: '2026-03-08T02:00:00.000Z',
            checkOut: null,
            status: 'NO_CHECKOUT',
            notes: 'Auto checkout by system (Mangkir)',
            user: {
                workingHourMode: 'FIXED',
            },
        },
        now: '2026-03-08T11:00:00.000Z',
        expected: {
            workerWebStatus: 'checked-in',
            adminExportLabel: 'TIDAK CHECKOUT',
        },
    },
    {
        id: 'outside-geofence-warn-accepted',
        attendance: {
            checkIn: '2026-03-08T03:15:00.000Z',
            checkOut: '2026-03-08T11:00:00.000Z',
            status: 'LATE',
            notes: 'Geofence warning accepted during check-in',
            user: {
                workingHourMode: 'FIXED',
            },
        },
        now: '2026-03-08T11:05:00.000Z',
        expected: {
            workerWebStatus: 'checked-out',
            adminExportLabel: 'TERLAMBAT',
        },
    },
]

export function getCrossSurfaceAttendanceFixture(id: string) {
    return crossSurfaceAttendanceFixtures.find((fixture) => fixture.id === id)
}
