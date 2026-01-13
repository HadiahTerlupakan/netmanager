import { prisma } from '@/lib/prisma'
import { GeofenceService } from './GeofenceService'
import { AttendanceValidationService } from './AttendanceValidationService'
import { AttendanceTimezoneService } from './AttendanceTimezoneService'
import { AttendanceStatus } from '@prisma/client'
import { randomUUID } from 'crypto'
import { ATTENDANCE_CONSTANTS } from '@/lib/attendance-constants'
import { cache } from '@/lib/cache'
import { AttendanceRepository } from '../repositories/AttendanceRepository'
import { OvertimeRepository } from '../../overtime/repositories/OvertimeRepository'

interface CheckInParams {
    userId: string
    photoUrl: string | null
    location: string
    notes: string
    latitude?: number
    longitude?: number
    offlineTime?: Date // For mobile offline sync
    timezone?: string
}

export class AttendanceService {
    private geofenceService: GeofenceService
    private validationService: AttendanceValidationService
    private timezoneService: AttendanceTimezoneService

    constructor() {
        this.geofenceService = new GeofenceService()
        this.validationService = new AttendanceValidationService()
        this.timezoneService = new AttendanceTimezoneService()
    }

    async checkIn(params: CheckInParams) {
        const { userId, photoUrl, location, notes, latitude, longitude, offlineTime, timezone } = params

        // 1. Timezone & Date Context
        // Use offlineTime if provided (trusted for sync), else server time
        const checkInTime = offlineTime || new Date()
        
        // Get timezone from service if not provided
        const tz = timezone || await this.timezoneService.getTimezone()
        
        // Use timezone service to get effective date
        const { now: nowInTz, startOfDay: effectiveToday } = this.timezoneService.getEffectiveDate(tz)

        // 2. Cross-Module Validation (Leave & Holiday)
        // Check using the User's Timezone Date
        const eligibility = await this.validationService.validateCheckInEligibility(userId, nowInTz)
        if (!eligibility.isValid) {
            throw new Error(`CHECKIN_REJECTED:${eligibility.reason}`) // Format error for controller to parse
        }

        // 3. User Settings & Schedule (with caching)
        const cacheKey = `user:schedule:${userId}`
        const cachedSchedule = cache.get<{ startWorkTime: string | null, endWorkTime: string | null, workingHourMode: string | null, shiftId: string | null, shift: { startTime: string, endTime: string } | null }>(cacheKey)
        
        let userDetails: { startWorkTime: string | null, endWorkTime: string | null, workingHourMode: string | null, shiftId: string | null, shift: { startTime: string, endTime: string } | null } | null
        if (cachedSchedule) {
            userDetails = cachedSchedule
        } else {
            userDetails = await prisma.user.findUnique({
                where: { id: userId },
                select: { 
                    startWorkTime: true, 
                    endWorkTime: true, 
                    workingHourMode: true, 
                    shiftId: true,
                    shift: { select: { startTime: true, endTime: true } }
                }
            })
            // Cache for 1 hour
            if (userDetails) {
                cache.set(cacheKey, userDetails, 3600)
            }
        }

        // 4. Auto-Checkout Stale Sessions
        await this.processAutoCheckout(userId, userDetails, effectiveToday)

        // 5. Duplicate Check
        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: { gte: effectiveToday }
            }
        })
        if (existingAttendance) {
            throw new Error('DUPLICATE_ENTRY')
        }

        // 6. Geofence Validation
        let geofenceResult = {
            status: 'UNKNOWN',
            distance: null as number | null,
            siteName: null as string | null
        }
        
        if (latitude !== undefined && longitude !== undefined) {
            const geoCheck = await this.geofenceService.validateGeofence(userId, latitude, longitude)
            geofenceResult = {
                status: geoCheck.isInside ? 'INSIDE' : 'OUTSIDE',
                distance: geoCheck.nearestDistance,
                siteName: geoCheck.nearestSiteName
            }
        }

        // 7. Status Calculation (LATE vs ON_TIME)
        let status: AttendanceStatus = 'ON_TIME'
        if (userDetails?.workingHourMode !== 'FLEXIBLE') {
            // Determine schedule time: for SHIFT mode, use shift schedule; otherwise use user's startWorkTime
            let scheduleTime = userDetails?.startWorkTime
            if (userDetails?.workingHourMode === 'SHIFT' && userDetails?.shift) {
                scheduleTime = userDetails.shift.startTime
            }
            
            if (scheduleTime) {
                status = await this.timezoneService.calculateStatus(
                    checkInTime,
                    scheduleTime,
                    tz
                )
            }
        }

        // 8. Create Record
        return await prisma.attendance.create({
            data: {
                id: randomUUID(),
                userId,
                checkIn: checkInTime,
                checkInPhoto: photoUrl,
                location,
                notes,
                status,
                geofenceStatus: geofenceResult.status,
                geofenceDistance: geofenceResult.distance,
                geofenceSiteName: geofenceResult.siteName,
                geofenceMeta: offlineTime ? { offline: true, capturedAt: offlineTime.toISOString() } : undefined,
                updatedAt: new Date()
            }
        })
    }

    private async processAutoCheckout(userId: string, userDetails: any, effectiveToday: Date) {
        // Skip for flexible users
        if (userDetails?.workingHourMode === 'FLEXIBLE') return

        const staleSessions = await prisma.attendance.findMany({
            where: {
                userId,
                checkOut: null,
                checkIn: { lt: effectiveToday }
            }
        })

        if (staleSessions.length === 0) return

        await Promise.all(staleSessions.map(async (session) => {
            let autoCheckOut = new Date(session.checkIn)
            
            // Logic Auto Checkout - same as legacy
            if (userDetails?.endWorkTime) {
                const [endHour, endMinute] = userDetails.endWorkTime.split(':').map(Number)
                autoCheckOut.setHours(endHour, endMinute, 0, 0)
            } else {
                autoCheckOut.setHours(17, 0, 0, 0)
            }

            // Adjust date if previous day logic needed? 
            // The legacy code used simple Hours setting on the CheckIn Date.
            // If checkIn was yesterday 08:00, autoCheckout becomes yesterday 17:00. Correct.
            
            // Safety: if config error makes checkout < checkin
            if (autoCheckOut <= session.checkIn) {
                // Fallback: CheckIn + default work hours
                autoCheckOut = new Date(session.checkIn.getTime() + ATTENDANCE_CONSTANTS.DEFAULT_WORK_HOURS * 3600000)
            }
            
            // Logic "Malam" -> end of day
            if (session.checkIn > autoCheckOut) {
                autoCheckOut.setHours(
                    ATTENDANCE_CONSTANTS.END_OF_DAY_HOUR,
                    ATTENDANCE_CONSTANTS.END_OF_DAY_MINUTE,
                    ATTENDANCE_CONSTANTS.END_OF_DAY_SECOND,
                    ATTENDANCE_CONSTANTS.END_OF_DAY_MILLISECOND
                )
            }

            const autoNote = ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE
            const newNotes = session.notes ? `${session.notes} ${autoNote}` : autoNote

            await prisma.attendance.update({
                where: { id: session.id },
                data: { 
                    checkOut: autoCheckOut, 
                    notes: newNotes,
                    status: 'ABSENT' // Consistent with AutoCheckoutService
                }
            })
        }))
    }

    /**
     * Centralized Check-Out Logic
     * Used by both web and mobile routes for consistency
     */
    async checkOut(params: {
        userId: string
        photoUrl: string | null
        location: string | null
        notes?: string
        latitude?: number
        longitude?: number
        offlineTime?: Date
    }): Promise<{
        attendance: any
        warning?: string
    }> {
        const { userId, photoUrl, location, notes, latitude, longitude, offlineTime } = params

        // 1. Find active attendance (last 24 hours)
        const searchStart = new Date()
        searchStart.setHours(searchStart.getHours() - 24)

        const attendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: { gte: searchStart },
                checkOut: null
            },
            orderBy: { checkIn: 'desc' },
            include: {
                user: {
                    select: {
                        workingHourMode: true,
                        flexibleTargetHour: true,
                        name: true
                    }
                }
            }
        })

        if (!attendance) {
            throw new Error('NO_ACTIVE_SESSION')
        }

        // 2. Calculate warning for FLEXIBLE users
        let warning: string | undefined
        if (attendance.user.workingHourMode === 'FLEXIBLE') {
            const checkInTime = new Date(attendance.checkIn).getTime()
            const now = Date.now()
            const durationHours = (now - checkInTime) / (1000 * 60 * 60)
            const targetHours = attendance.user.flexibleTargetHour || 8

            if (durationHours < targetHours) {
                const workedHours = Math.floor(durationHours)
                const workedMinutes = Math.round((durationHours % 1) * 60)
                const remainingHours = targetHours - durationHours
                const remainingHoursInt = Math.floor(remainingHours)
                const remainingMinutes = Math.round((remainingHours % 1) * 60)

                warning = `Jam kerja Anda baru ${workedHours} jam ${workedMinutes} menit. Target kerja: ${targetHours} jam. Kurang ${remainingHoursInt} jam ${remainingMinutes} menit.`
            }
        }

        // 3. Geofence validation
        let checkOutGeofenceStatus = 'UNKNOWN'
        let checkOutGeofenceDistance: number | null = null

        if (latitude !== undefined && longitude !== undefined) {
            const geoCheck = await this.geofenceService.validateGeofence(userId, latitude, longitude)
            checkOutGeofenceStatus = geoCheck.isInside ? 'INSIDE' : 'OUTSIDE'
            checkOutGeofenceDistance = geoCheck.nearestDistance
        }

        // 4. Prepare notes
        const finalNotes = notes
            ? (attendance.notes ? `${attendance.notes}; Checkout Note: ${notes}` : notes)
            : attendance.notes

        // 5. Update record
        const checkOutTime = offlineTime || new Date()
        
        const updatedAttendance = await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
                checkOut: checkOutTime,
                checkOutPhoto: photoUrl,
                checkOutLocation: location || undefined,
                checkOutGeofenceStatus,
                checkOutGeofenceDistance,
                notes: finalNotes,
                updatedAt: new Date()
            }
        })

        return { attendance: updatedAttendance, warning }
    }

    async getReportData(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const repository = new AttendanceRepository()
        const overtimeRepository = new OvertimeRepository()

        const [stats, dailyStats, groupedBySite, groupedByDept, topEmployees, userAttStats, userOtStats, topAbsentees, userTotalDuration, userAbsenceStats] = await Promise.all([
            repository.getStatsByDateRange(startDate, endDate, siteId, departmentId),
            repository.getDailyStats(startDate, endDate, siteId, departmentId),
            repository.getGroupedStats(startDate, endDate, 'site'),
            repository.getGroupedStats(startDate, endDate, 'department'),
            repository.getTopEmployees(startDate, endDate, 5, siteId, departmentId),
            repository.getUserAttendanceStats(startDate, endDate, siteId, departmentId),
            overtimeRepository.getUserOvertimeStats(startDate, endDate, siteId, departmentId),
            repository.getTopAbsentees(startDate, endDate, 5, siteId, departmentId),
            repository.getUserTotalDuration(startDate, endDate, siteId, departmentId),
            repository.getUserAbsenceStats(startDate, endDate, siteId, departmentId)
        ])

        // Calculate Combined Top Employees (Star Employees)
        const userMap = new Map<string, { days: number, officialOtMinutes: number, excessMinutes: number, totalMinutes: number, alphaCount: number }>()

        // 1. Base Attendance Days
        userAttStats.forEach(item => {
            if (!userMap.has(item.userId)) userMap.set(item.userId, { days: 0, officialOtMinutes: 0, excessMinutes: 0, totalMinutes: 0, alphaCount: 0 })
            const current = userMap.get(item.userId)!
            current.days = item._count._all
        })

        // 2. Formal Overtime (Approved/Completed)
        userOtStats.forEach(item => {
             if (!userMap.has(item.userId)) userMap.set(item.userId, { days: 0, officialOtMinutes: 0, excessMinutes: 0, totalMinutes: 0, alphaCount: 0 })
             const current = userMap.get(item.userId)!
             current.officialOtMinutes += (item._sum.duration || 0)
        })

        // 3. Absence Stats (Penalties)
        userAbsenceStats.forEach(item => {
            if (!userMap.has(item.userId)) userMap.set(item.userId, { days: 0, officialOtMinutes: 0, excessMinutes: 0, totalMinutes: 0, alphaCount: 0 })
            const current = userMap.get(item.userId)!
            current.alphaCount = item._count._all
        })

        // 4. Implicit Overtime & Total Duration
        userTotalDuration.forEach((totalMinutes, userId) => {
             if (!userMap.has(userId)) userMap.set(userId, { days: 0, officialOtMinutes: 0, excessMinutes: 0, totalMinutes: 0, alphaCount: 0 })
             const current = userMap.get(userId)!
             
             // Set absolute total working minutes
             current.totalMinutes = totalMinutes

             // Standard Work Minutes = Days Present * 8 hours * 60 minutes
             const standardMinutes = current.days * 480
             
             if (totalMinutes > standardMinutes) {
                 const excess = totalMinutes - standardMinutes
                 // Add excess minutes to record
                 current.excessMinutes += excess
             }
        })

        const scoredUsers = Array.from(userMap.entries()).map(([userId, stats]) => {
            // Scoring System:
            // 1 Day Present = 10 pts
            // 1 Day Alpha = -50 pts (Penalty)
            // Official Overtime = 2 pts/hour (1 pt per 30 mins)
            // Extra/Excess Overtime = 4 pts/hour (1 pt per 15 mins)
            
            const officialScore = Math.floor(stats.officialOtMinutes / 30)
            const excessScore = Math.floor(stats.excessMinutes / 15)
            const alphaPenalty = stats.alphaCount * 20
            
            const totalOtMinutes = stats.officialOtMinutes + stats.excessMinutes
            const score = (stats.days * 10) + officialScore + excessScore - alphaPenalty
            
            return { 
                userId, 
                score, 
                details: { 
                    days: stats.days, 
                    alphaCount: stats.alphaCount,
                    otHours: parseFloat((totalOtMinutes / 60).toFixed(1)), // Total OT
                    officialOtHours: parseFloat((stats.officialOtMinutes / 60).toFixed(1)), // Resmi
                    excessHours: parseFloat((stats.excessMinutes / 60).toFixed(1)), // Ekstra
                    totalHours: parseFloat((stats.totalMinutes / 60).toFixed(1)) // Total Jam Kerja
                } 
            }
        })

        // Sort by Score DESC
        scoredUsers.sort((a, b) => b.score - a.score)
        
        // Take Top 5
        const topScorers = scoredUsers.slice(0, 5)

        // Fetch User Details
        let combinedTopEmployees: any[] = []
        if (topScorers.length > 0) {
            const topScorerDetails = await prisma.user.findMany({
                where: { id: { in: topScorers.map(u => u.userId) } },
                select: { 
                    id: true, 
                    name: true, 
                    image: true, 
                    sites: { select: { name: true } }, 
                    departments: { select: { name: true } } 
                }
            })

            combinedTopEmployees = topScorers.map(scorer => {
                const user = topScorerDetails.find(u => u.id === scorer.userId)
                return {
                    user,
                    score: scorer.score,
                    details: scorer.details
                }
            }).filter(u => u.user)
        }

        // Calculate derived stats
        const lateCount = stats.statusCounts['LATE'] || 0
        const lateRate = stats.total > 0 ? (lateCount / stats.total) * 100 : 0

        const alphaCount = stats.statusCounts['ALPHA'] || 0
        // Alpha rate relative to active users? OR relative to total attendance records?
        // Usually relative to total expected days, but for simple report, maybe just count.
        // Or % of total records (which includes presences).
        // If 10 presence, 1 alpha. Total 11. Alpha rate 1/11.
        // Wait, stats.total is count of ALL records (including ALPHA).
        // Since ALPHA is a record now.
        const alphaRate = stats.total > 0 ? (alphaCount / stats.total) * 100 : 0
        
        return {
            summary: {
                totalAttendance: stats.total,
                attendanceRate: 0, // Placeholder
                avgDurationMinutes: stats.avgDurationMinutes,
                lateCount,
                lateRate,
                alphaCount,
                alphaRate
            },
            trends: dailyStats,
            bySite: groupedBySite,
            byDepartment: groupedByDept,
            topEmployees,
            combinedTopEmployees,
            topAbsentees
        }
    }
}
