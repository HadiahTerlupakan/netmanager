import { toZonedTime, toDate } from 'date-fns-tz'
import { startOfDay as fnsStartOfDay, endOfDay as fnsEndOfDay } from 'date-fns'
import { HolidayRepository } from '../repositories/HolidayRepository'
import { LeaveRepository } from '../repositories/LeaveRepository'
import { UserRepository } from '@/modules/users/repositories/UserRepository'
import { isOffDayForUser } from '../utils/workingDayUtils'

export class AttendanceValidationService {
    private leaveRepo: LeaveRepository
    private holidayRepo: HolidayRepository
    private userRepo: UserRepository

    constructor() {
        this.leaveRepo = new LeaveRepository()
        this.holidayRepo = new HolidayRepository()
        this.userRepo = new UserRepository()
    }

    /**
     * Memvalidasi apakah user bisa check-in pada tanggal tertentu
     * Checks:
     * 1. Apakah ada Cuti yang disetujui (APPROVED) pada tanggal tersebut?
     * 2. Apakah tanggal tersebut adalah Hari Libur (Holiday)?
     * 3. Apakah tanggal tersebut adalah Off Day (bukan jadwal kerja)?
     */
    async validateCheckInEligibility(userId: string, timezone: string, date: Date = new Date(), tenantId?: string): Promise<{
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

        // 1. Check Leave Requests (Cuti/Izin) via repository
        const activeLeave = await this.leaveRepo.findActiveLeaveForUserOnDate(userId, startOfDay, endOfDay, tenantId)

        if (activeLeave) {
            return {
                isValid: false,
                reason: `Anda sedang cuti/izin: ${activeLeave.type}`,
                type: 'LEAVE'
            }
        }

        // 2. Check Holidays — use HolidayRepository for consistent caching
        if (tenantId) {
            const { isHoliday, holiday } = await this.holidayRepo.isHoliday(startOfDay, tenantId)

            if (isHoliday && holiday) {
                return {
                    isValid: false,
                    reason: `Hari ini adalah hari libur: ${holiday.description}`,
                    type: 'HOLIDAY'
                }
            }
        } else {
            // Fallback: direct query when no tenantId (shouldn't happen in normal flow)
            // For now, skip holiday check without tenantId to maintain repository pattern
            // This could be extended with a global holiday repository method if needed
        }

        // 3. Check Off Days (Jadwal Kerja User) — use UserRepository
        const user = await this.userRepo.findWorkScheduleById(userId)

        // Use timezone-aware day-of-week from the zoned date
        const dayOfWeek = zonedDate.getDay()

        if (isOffDayForUser(dayOfWeek, user?.workDays ?? null, user?.workingHourMode ?? null)) {
            return {
                isValid: false,
                reason: `Hari ini bukan jadwal kerja Anda`,
                type: 'OFF_DAY'
            }
        }

        return { isValid: true }
    }
}
