
import { prisma } from '@/lib/prisma'

export class AutoCheckoutService {
    /**
     * Run automatic checkout for users who forgot to check out.
     * This should run daily at 23:59 or similar.
     */
    static async runAutoCheckout() {
        const today = new Date()
        const startOfDay = new Date(today.setHours(0, 0, 0, 0))
        const endOfDay = new Date(today.setHours(23, 59, 59, 999))

        // Default checkout time: 17:00 today
        const defaultCheckoutTime = new Date()
        defaultCheckoutTime.setHours(17, 0, 0, 0)

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
                // Determine checkout time
                // Ideally we should check for shift data here
                // For now, we use the default 17:00, OR if check-in was after 17:00, use check-in time + 1 hour (?)
                // Let's stick to the agreed 17:00 default. 
                // However, if they checked in AFTER 17:00, it would result in negative duration.
                // Safety check: if checkIn > defaultCheckoutTime, use checkIn + 8 hours

                let checkoutTime = new Date(defaultCheckoutTime)

                if (attendance.checkIn > checkoutTime) {
                    // Late shift or overtime checkin? 
                    // Set checkout to 8 hours after checkin as a fallback for late shifts
                    checkoutTime = new Date(attendance.checkIn.getTime() + (8 * 60 * 60 * 1000))
                }

                await prisma.attendance.update({
                    where: { id: attendance.id },
                    data: {
                        checkOut: checkoutTime,
                        notes: attendance.notes ? `${attendance.notes}; Auto checkout by system` : 'Auto checkout by system',
                        status: 'PRESENT' // Ensure status is present
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
