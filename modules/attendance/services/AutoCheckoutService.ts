import { prisma } from '@/lib/prisma'
import { getTimezone } from '@/lib/utils/get-timezone'
import { toEndOfDay } from '@/lib/utils/server-datetime'


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
                let shouldCheckout = true
                const checkInDate = new Date(attendance.checkIn)
                let checkOutTime = new Date(checkInDate)

                // Default force checkout at 23:59:59 of the check-in day
                checkOutTime.setTime(toEndOfDay(checkOutTime).getTime())

                // Special handling for SHIFT mode due to potential Overnight Shifts
                if (user.workingHourMode === 'FLEXIBLE') {
                    // For flexible users, if they reached here, it means they have been checked in > 24 hours.
                    // We set checkout time to exactly 24 hours after check-in.
                    checkOutTime = new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000)
                } else if (user.workingHourMode === 'SHIFT' && user.shift) {
                    const startH = parseInt(user.shift.startTime.split(':')[0] ?? '0')
                    const endH = parseInt(user.shift.endTime.split(':')[0] ?? '0')

                    // Detect overnight shift (End Hour < Start Hour, e.g. 04:00 < 21:00)
                    const isOvernight = endH < startH

                    if (isOvernight) {
                        // For overnight shifts, the end time is on the NEXT day
                        const shiftEndDate = new Date(checkInDate)
                        shiftEndDate.setDate(shiftEndDate.getDate() + 1)
                        shiftEndDate.setHours(endH, parseInt(user.shift.endTime.split(':')[1] ?? '0'), 0, 0)

                        // If the current time (when cron runs) is BEFORE the shift ends, DO NOT checkout yet.
                        // Example: Shift 21:00-04:00. Check-in 21:00 Mon. Cron 23:59 Mon.
                        // Now (23:59 Mon) < ShiftEnd (04:00 Tue). -> SKIP.
                        if (now < shiftEndDate) {
                            shouldCheckout = false
                            // console.log(`[AutoCheckout] Skipping ${user.name} (Shift ${user.shift.name}). Overnight shift in progress.`)
                        } else {
                            // If we are past the shift end (e.g. Cron runs next day),
                            // we set checkout time to the Shift End Time (as per "Mangkir" logic usually maxing out at shift end)
                            // OR we keep it at 23:59 of CheckIn day depending on policy.
                            // Better policy for overnight mangkir: Set to Shift End Time.
                            checkOutTime = shiftEndDate
                        }
                    } else {
                        // Normal shift (same day). 
                        // If standard day shift ended at 17:00, and now is 23:59, we force checkout.
                        // We can set checkOutTime to Shift End Time instead of 23:59 for better accuracy?
                        // For now, let's stick to 23:59 to accept late OT unless specified otherwise,
                        // BUT consistent with overnight, maybe setting to Shift End Time is cleaner for auto-mangkir?
                        // Let's stick to existing logic (23:59) for same-day to allow potential OT recording until midnight.
                    }
                }

                if (shouldCheckout) {
                    await prisma.attendance.update({
                        where: { id: attendance.id },
                        data: {
                            checkOut: checkOutTime,
                            notes: attendance.notes ? `${attendance.notes}; Auto checkout by system (Mangkir)` : 'Auto checkout by system (Mangkir)',
                            status: 'ABSENT'
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
