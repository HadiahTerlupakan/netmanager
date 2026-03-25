import { prisma } from '@/lib/prisma'
import { toZonedTime, toDate } from 'date-fns-tz'
import { startOfDay as fnsStartOfDay, endOfDay as fnsEndOfDay } from 'date-fns'
export class AttendanceValidationService {
    /**
     * Memvalidasi apakah user bisa check-in pada tanggal tertentu
     * Checks:
     * 1. Apakah ada Cuti yang disetujui (APPROVED) pada tanggal tersebut?
     * 2. Apakah tanggal tersebut adalah Hari Libur (Holiday)?
     */
    async validateCheckInEligibility(userId: string, timezone: string, date: Date = new Date()): Promise<{
        isValid: boolean
        reason?: string
        type?: 'LEAVE' | 'HOLIDAY' | 'OFF_DAY'
    }> {
        // Build the correct timezone boundaries
        const zonedDate = toZonedTime(date, timezone)
        
        // Start and end of day in the specified timezone
        const localStartOfDay = fnsStartOfDay(zonedDate)
        const localEndOfDay = fnsEndOfDay(zonedDate)
        
        // Convert to UTC Date objects for accurate Prisma queries
        const startOfDay = toDate(localStartOfDay, { timeZone: timezone })
        const endOfDay = toDate(localEndOfDay, { timeZone: timezone })

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
        
        // 3. Check Off Days (Jadwal Kerja User)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { workDays: true, workingHourMode: true }
        })

        // User FLEXIBLE tidak terpengaruh workDays - bisa absen setiap hari
        if (user?.workDays && user?.workingHourMode !== 'FLEXIBLE') {
            const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday
            const dayMap: Record<string, number> = { 
                'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
                'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6,
                '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
            }
            
            const workDays = user.workDays.split(',').map(d => {
                const trimmed = d.trim()
                const parsed = parseInt(trimmed)
                if (!isNaN(parsed)) return parsed
                return dayMap[trimmed]
            }).filter(d => d !== undefined)

            // SAFEGUARD: Jika workDays kosong setelah parsing (misal: workDays=""), 
            // jangan blokir user - izinkan check-in (default fleksibel)
            if (workDays.length > 0 && !workDays.includes(dayOfWeek)) {
                return {
                    isValid: false,
                    reason: `Hari ini bukan jadwal kerja Anda`,
                    type: 'OFF_DAY'
                }
            }
        }

        return { isValid: true }
    }
}
