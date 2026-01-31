import { prisma } from '@/lib/prisma'
import { HolidayRepository } from '../repositories/HolidayRepository'
import { LeaveRepository } from '../repositories/LeaveRepository'
import { randomUUID } from 'crypto'

export class AbsenceService {
    private holidayRepo: HolidayRepository
    private leaveRepo: LeaveRepository

    constructor() {
        this.holidayRepo = new HolidayRepository()
        this.leaveRepo = new LeaveRepository()
    }

    /**
     * Process absence for a specific date.
     * Ideally run for YESTERDAY (H-1) to ensure full day has passed.
     * 
     * @param targetDate The date to check for absences
     */
    async processDailyAbsence(targetDate: Date) {
        // Normalize date to start of day
        const startOfDay = new Date(targetDate)
        startOfDay.setHours(0, 0, 0, 0)
        
        const endOfDay = new Date(targetDate)
        endOfDay.setHours(23, 59, 59, 999)

        // 1. Check if targetDate is a Holiday
        const holidays = await this.holidayRepo.findMany({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        })
        
        if (holidays.length > 0) {
            console.log(`[AbsenceService] ${targetDate.toDateString()} is a holiday. Skipping absence check.`)
            return { processed: 0, alpha: 0, message: 'Holiday' }
        }

        // 2. Get All Active Users (EXCLUDE FLEXIBLE mode - they don't have daily attendance requirements)
        // FLEXIBLE users accumulate working hours monthly, not daily check-in/out
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: {
                    name: { not: 'SUPER_ADMIN' } 
                },
                // IMPORTANT: Exclude FLEXIBLE users - they don't have fixed schedules
                // Their attendance is based on monthly hour accumulation, not daily presence
                workingHourMode: {
                    not: 'FLEXIBLE'
                }
            },
            select: {
                id: true,
                name: true,
                workDays: true,
                workingHourMode: true,
                shiftId: true,
                shift: true
            }
        })

        let alphaCount = 0

        // 3. Iterate and Check
        console.log(`[AbsenceService] Processing ${users.length} active users for ${targetDate.toDateString()}`)
        
        for (const user of users) {
             // 3.1 Check Work Days
             const dayOfWeek = targetDate.getDay() // 0-6
             let isWorkDay = false

             if (user.workDays) {
                 const rawDays = user.workDays.split(',').map(d => d.trim())
                 const dayMap: Record<string, number> = {
                     'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
                     'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6,
                     '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
                 }
                 
                 const days = rawDays.map(d => {
                     const parsed = parseInt(d)
                     if (!isNaN(parsed)) return parsed
                     return dayMap[d]
                 }).filter(d => d !== undefined)

                 if (days.includes(dayOfWeek)) {
                     isWorkDay = true
                 }
             } else {
                 isWorkDay = false
             }

             if (!isWorkDay) {
                 continue // Skip
             }

             // 3.2 Check Existing Attendance
             const attendance = await prisma.attendance.findFirst({
                 where: {
                     userId: user.id,
                     checkIn: {
                         gte: startOfDay,
                         lte: endOfDay
                     }
                 }
             })

             if (attendance) {
                 continue // Present
             }

             // 3.3 Check Approved Leave
             const leave = await prisma.leaveRequest.findFirst({
                 where: {
                     userId: user.id,
                     status: 'APPROVED',
                     startDate: { lte: endOfDay },
                     endDate: { gte: startOfDay }
                 }
             })

             if (leave) {
                 continue // On Leave
             }

             // 3.4 If all checks passed: MARK AS ALPHA
             try {
                // Set checkIn time to 00:00:00 (midnight) of that day
                // This signals that this is NOT a real check-in, just a placeholder record for ALPHA
                // UI should hide the time display for records with this midnight timestamp
                const alphaTime = new Date(startOfDay)
                alphaTime.setHours(0, 0, 0, 0)
                
                await prisma.attendance.create({
                    data: {
                        id: randomUUID(),
                        userId: user.id,
                        checkIn: alphaTime,
                        status: 'ALPHA',
                        notes: 'Tidak Masuk Kerja (Alpha) - Auto Generated',
                        location: 'System', 
                        updatedAt: new Date()
                    }
                })
                console.log(`[AbsenceService] Marked ALPHA for ${user.name} on ${targetDate.toDateString()}`)
                alphaCount++
             } catch (error) {
                 console.error(`[AbsenceService] Error creating Alpha for ${user.name}:`, error)
             }
        }

        return { processed: users.length, alpha: alphaCount }
    }
}
