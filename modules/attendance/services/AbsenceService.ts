import { prisma } from '@/lib/prisma'
import { HolidayRepository } from '../repositories/HolidayRepository'
import { LeaveRepository } from '../repositories/LeaveRepository'
import { randomUUID } from 'crypto'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'


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
     * @param tenantId The tenant ID to scope the operation
     */
    async processDailyAbsence(targetDate: Date, tenantId: string) {
        // Normalize date to start of day
        const startOfDay = new Date(targetDate)
        startOfDay.setTime(toStartOfDay(startOfDay).getTime())
        
        const endOfDay = new Date(targetDate)
        endOfDay.setTime(toEndOfDay(endOfDay).getTime())

        // 1. Check if targetDate is a Holiday
        const holidays = await this.holidayRepo.findMany(tenantId, {
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        })
        
        const isHoliday = holidays.length > 0

        // 2. Get All Active Users (EXCLUDE FLEXIBLE mode - they don't have daily attendance requirements)
        // FLEXIBLE users accumulate working hours monthly, not daily check-in/out
        const users = await prisma.user.findMany({
            where: {
                tenantId,
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

        let absentCount = 0
        let dayOffCount = 0

        // 3. Iterate and Check
        // console.log(`[AbsenceService] Processing ${users.length} active users for ${targetDate.toDateString()}`)
        
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

             // 3.2 Check Existing Attendance
             const attendance = await prisma.attendance.findFirst({
                 where: {
                     userId: user.id,
                     tenantId,
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
                     tenantId,
                     status: 'APPROVED',
                     startDate: { lte: endOfDay },
                     endDate: { gte: startOfDay }
                 }
             })

             if (leave) {
                 continue // On Leave
             }

             if (isHoliday || !isWorkDay) {
                try {
                    const dayOffTime = new Date(startOfDay)
                    dayOffTime.setTime(toStartOfDay(dayOffTime).getTime())

                    await prisma.attendance.create({
                        data: {
                            id: randomUUID(),
                            userId: user.id,
                            tenantId,
                            checkIn: dayOffTime,
                            status: 'DAY_OFF',
                            notes: isHoliday
                                ? 'Hari Libur (Day Off) - Auto Generated'
                                : 'Hari Off (Day Off) - Auto Generated',
                            location: 'System',
                            updatedAt: new Date()
                        }
                    })
                    dayOffCount++
                } catch (error) {
                    console.error(`[AbsenceService] Error creating Day Off for ${user.name}:`, error)
                }

                continue
             }

            try {
                // Set checkIn time to 00:00:00 (midnight) of that day
                // UI should hide the time display for records with this midnight timestamp
                const alphaTime = new Date(startOfDay)
                alphaTime.setTime(toStartOfDay(alphaTime).getTime())
                
                await prisma.attendance.create({
                    data: {
                        id: randomUUID(),
                        userId: user.id,
                        tenantId,
                        checkIn: alphaTime,
                        status: 'ABSENT',
                        notes: 'Tidak Masuk Kerja (Absent) - Auto Generated',
                        location: 'System', 
                        updatedAt: new Date()
                    }
                })
                absentCount++
            } catch (error) {
                console.error(`[AbsenceService] Error creating Absent for ${user.name}:`, error)
            }
        }

        return { processed: users.length, absent: absentCount, dayOff: dayOffCount, ...(isHoliday ? { message: 'Holiday' } : {}) }
    }

    async syncDayOffAttendanceRange(startDate: Date, endDate: Date, tenantId: string, userId?: string) {
        const current = new Date(startDate)
        current.setTime(toStartOfDay(current).getTime())

        const last = new Date(endDate)
        last.setTime(toStartOfDay(last).getTime())

        while (current <= last) {
            const startOfDay = new Date(current)
            startOfDay.setTime(toStartOfDay(startOfDay).getTime())
            const endOfDay = new Date(current)
            endOfDay.setTime(toEndOfDay(endOfDay).getTime())

            const holidays = await this.holidayRepo.findMany(tenantId, {
                where: {
                    date: {
                        gte: startOfDay,
                        lte: endOfDay
                    }
                }
            })

            const isHoliday = holidays.length > 0

            const users = await prisma.user.findMany({
                where: {
                    tenantId,
                    isActive: true,
                    ...(userId ? { id: userId } : {}),
                    role: { name: { not: 'SUPER_ADMIN' } },
                    workingHourMode: { not: 'FLEXIBLE' }
                },
                select: {
                    id: true,
                    name: true,
                    workDays: true
                }
            })

            const dayOfWeek = current.getDay()
            for (const user of users) {
                const rawDays = user.workDays ? user.workDays.split(',').map(d => d.trim()) : []
                const dayMap: Record<string, number> = {
                    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
                    'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6,
                    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
                }
                const workDays = rawDays.map(d => {
                    const parsed = parseInt(d)
                    if (!isNaN(parsed)) return parsed
                    return dayMap[d]
                }).filter(d => d !== undefined)
                const isWorkDay = workDays.includes(dayOfWeek)

                if (!isHoliday && isWorkDay) {
                    continue
                }

                const attendance = await prisma.attendance.findFirst({
                    where: {
                        userId: user.id,
                        tenantId,
                        checkIn: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    }
                })

                if (attendance) {
                    continue
                }

                const leave = await prisma.leaveRequest.findFirst({
                    where: {
                        userId: user.id,
                        tenantId,
                        status: 'APPROVED',
                        startDate: { lte: endOfDay },
                        endDate: { gte: startOfDay }
                    }
                })

                if (leave) {
                    continue
                }

                const checkInTime = new Date(startOfDay)
                await prisma.attendance.create({
                    data: {
                        id: randomUUID(),
                        userId: user.id,
                        tenantId,
                        checkIn: checkInTime,
                        status: 'DAY_OFF',
                        notes: isHoliday
                            ? 'Hari Libur (Day Off) - Auto Generated'
                            : 'Hari Off (Day Off) - Auto Generated',
                        location: 'System',
                        updatedAt: new Date()
                    }
                })
            }

            current.setDate(current.getDate() + 1)
        }
    }
}
