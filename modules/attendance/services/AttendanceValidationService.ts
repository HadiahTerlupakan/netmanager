import { prisma } from '@/lib/prisma'

export class AttendanceValidationService {
    /**
     * Memvalidasi apakah user bisa check-in pada tanggal tertentu
     * Checks:
     * 1. Apakah ada Cuti yang disetujui (APPROVED) pada tanggal tersebut?
     * 2. Apakah tanggal tersebut adalah Hari Libur (Holiday)?
     */
    async validateCheckInEligibility(userId: string, date: Date = new Date()): Promise<{
        isValid: boolean
        reason?: string
        type?: 'LEAVE' | 'HOLIDAY' | 'OFF_DAY'
    }> {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        // 1. Check Leave Requests (Cuti/Izin)
        const activeLeave = await prisma.leaveRequest.findFirst({
            where: {
                userId,
                status: 'APPROVED',
                startDate: { lte: endOfDay },
                endDate: { gte: startOfDay }
            },
            select: {
                type: true,
                reason: true
            }
        })

        if (activeLeave) {
            return {
                isValid: false,
                reason: `Anda sedang cuti/izin: ${activeLeave.type}`,
                type: 'LEAVE'
            }
        }

        // 2. Check Holidays
        const holiday = await prisma.holiday.findFirst({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            select: {
                description: true,
                isNational: true
            }
        })

        if (holiday) {
            return {
                isValid: false,
                reason: `Hari ini adalah hari libur: ${holiday.description}`,
                type: 'HOLIDAY'
            }
        }
        
        // 3. Check Off Days (Jadwal Kerja) - Future Implementation
        // Jika mode SHIFT atau FIXED dengan hari kerja spesifik, cek di sini.
        // Saat ini default valid untuk simplifikasi Phase 1.

        return { isValid: true }
    }
}
