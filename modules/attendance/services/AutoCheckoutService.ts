
import { prisma } from '@/lib/prisma'

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
        const today = new Date()
        const endOfToday = new Date(today)
        endOfToday.setHours(23, 59, 59, 999)

        // 1. Find all active attendance (checkOut is null)
        // We catch everything up to the current moment.
        const openAttendances = await prisma.attendance.findMany({
            where: {
                checkOut: null,
                checkIn: {
                    lte: endOfToday
                }
            }
        })

        console.log(`[AutoCheckout] Found ${openAttendances.length} users to auto-checkout.`)

        let updatedCount = 0

        for (const attendance of openAttendances) {
            try {
                // Determine appropriate checkout time based on CheckIn Date
                const checkInDate = new Date(attendance.checkIn)
                const checkOutTime = new Date(checkInDate)
                checkOutTime.setHours(23, 59, 59, 999)

                await prisma.attendance.update({
                    where: { id: attendance.id },
                    data: {
                        checkOut: checkOutTime,
                        notes: attendance.notes ? `${attendance.notes}; Auto checkout by system (Mangkir)` : 'Auto checkout by system (Mangkir)',
                        status: 'MANGKIR'
                    }
                })

                updatedCount++
            } catch (error) {
                console.error(`[AutoCheckout] Failed to update attendance ${attendance.id}:`, error)
            }
        }

        console.log(`[AutoCheckout] Successfully auto-checked out ${updatedCount} users.`)
        return updatedCount
    }
}
