
import { prisma } from '@/lib/prisma'

export class AutoCheckoutService {
    /**
     * Run automatic checkout for users who forgot to check out.
     * This should run daily at 23:59.
     * 
     * Logic:
     * - Find active check-ins (checkOut is null)
     * - Set checkOut time to 23:59:59 (End of Day)
     * - Set status to 'MANGKIR'
     * - Add system note
     */
    static async runAutoCheckout() {
        // Use current time for the "today" reference
        const today = new Date()
        const startOfDay = new Date(today)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999)

        // Checkout Time: 23:59:59
        const checkoutTime = new Date(endOfDay)

        // 1. Find all active attendance for today (checked in but not checked out)
        const openAttendances = await prisma.attendance.findMany({
            where: {
                checkIn: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                checkOut: null
            }
        })

        console.log(`[AutoCheckout] Found ${openAttendances.length} users to auto-checkout.`)

        let updatedCount = 0

        for (const attendance of openAttendances) {
            try {
                await prisma.attendance.update({
                    where: { id: attendance.id },
                    data: {
                        checkOut: checkoutTime,
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
