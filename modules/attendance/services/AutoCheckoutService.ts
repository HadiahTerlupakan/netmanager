import { prisma } from '@/lib/prisma'
import { getTimezone } from '@/lib/utils/get-timezone'
import { toEndOfDay } from '@/lib/utils/server-datetime'
import { ATTENDANCE_CONSTANTS } from '../constants'
import { AttendanceSessionPolicyService } from './AttendanceSessionPolicyService'


export class AutoCheckoutService {
    /**
     * Run automatic checkout for users who forgot to check out.
     * This should run daily at 23:59.
     * 
     * Logic:
     * - Find ALL active check-ins (checkOut is null), regardless of date.
     * - For each record:
     *   - If checkIn date is TODAY: Set checkOut to TODAY 23:59:59.
     *   - If checkIn date is PAST: Set checkOut to THAT DATE 23:59:59.
     * - Set status to 'MANGKIR'.
     * - Add system note.
     */
    static async runAutoCheckout() {
        const sessionPolicyService = new AttendanceSessionPolicyService()
        const timezone = await getTimezone()

        // Use timezone-aware current time
        const now = new Date()
        const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }))

        const endOfToday = new Date(nowInTz)
        endOfToday.setTime(toEndOfDay(endOfToday).getTime())

        // 1. Find all active attendance (checkOut is null)
        // We catch everything up to the current moment.
        // IMPORTANT: Exclude FLEXIBLE users - they don't have fixed schedules
        // so they shouldn't be auto-checked out and marked as MANGKIR
        // ALSO: Exclude ALPHA records - they are created by AbsenceService for users who didn't check-in at all
        // ALPHA records should NOT have checkOut time added
        const openAttendances = await prisma.attendance.findMany({
            where: {
                checkOut: null,
                checkIn: {
                    lte: endOfToday
                },
                // IMPORTANT: Skip ALPHA records - they are placeholder records for absent users
                // Adding checkOut to ALPHA records would create false working hours
                status: {
                    not: 'ALPHA'
                },
                OR: [
                    {
                        user: {
                            workingHourMode: {
                                not: 'FLEXIBLE'
                            }
                        }
                    },
                    {
                        user: {
                            workingHourMode: 'FLEXIBLE'
                        },
                        checkIn: {
                            // Flexible users are only auto-checked out if they've been checked in for more than 24 hours
                            lte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
                        }
                    }
                ]
            },
            include: {
                user: {
                    select: {
                        name: true,
                        workingHourMode: true,
                        shift: true // Include shift details
                    }
                }
            }
        })


        // console.log(`[AutoCheckout] Found ${openAttendances.length} open sessions. Processing...`)

        let updatedCount = 0

        for (const attendance of openAttendances) {
            try {
                const { user } = attendance
                const decision = sessionPolicyService.resolve({
                    attendance: {
                        id: attendance.id,
                        checkIn: attendance.checkIn,
                        checkOut: attendance.checkOut,
                        status: attendance.status,
                        user: {
                            workingHourMode: user.workingHourMode as 'FIXED' | 'SHIFT' | 'FLEXIBLE' | null,
                            flexibleTargetHour: null,
                            shift: user.shift ? {
                                startTime: user.shift.startTime,
                                endTime: user.shift.endTime
                            } : null
                        }
                    },
                    now,
                    scheduleEndTime: null
                })

                if (decision.shouldAutoCheckout && decision.autoCheckoutAt && decision.nextStatus) {
                    await prisma.attendance.update({
                        where: { id: attendance.id },
                        data: {
                            checkOut: decision.autoCheckoutAt,
                            notes: attendance.notes ? `${attendance.notes}; ${ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE}` : ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE,
                            status: decision.nextStatus
                        }
                    })
                    updatedCount++
                }
            } catch (error) {
                console.error(`[AutoCheckout] Failed to update attendance ${attendance.id}:`, error)
            }
        }

        // console.log(`[AutoCheckout] Successfully auto-checked out ${updatedCount} users.`)
        return updatedCount
    }
}
