import { prisma } from '@/lib/prisma'
import { GeofenceService } from './GeofenceService'
import { AttendanceValidationService } from './AttendanceValidationService'
import { AttendanceTimezoneService } from './AttendanceTimezoneService'
import { AttendanceStatus, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { ATTENDANCE_CONSTANTS } from '@/modules/attendance/constants'
import { cache } from '@/lib/cache'
import { AttendanceRepository } from '../repositories/AttendanceRepository'
import { OvertimeRepository } from '../../overtime/repositories/OvertimeRepository'
import { LeaveRepository } from '../repositories/LeaveRepository'

interface CheckInParams {
    userId: string
    photoUrl: string | null
    location: string
    notes: string
    latitude?: number
    longitude?: number
    offlineTime?: Date // For mobile offline sync
    timezone?: string
    tenantId?: string
}

type AttendanceGeofencePolicy = 'STRICT' | 'WARN' | 'DISABLED'

type CachedUserAttendanceSettings = {
    startWorkTime: string | null
    endWorkTime: string | null
    workingHourMode: string | null
    attendanceGeofencePolicy: AttendanceGeofencePolicy | null
    shiftId: string | null
    shift: { startTime: string, endTime: string } | null
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
        const { userId, photoUrl, location, notes, latitude, longitude, offlineTime, timezone, tenantId } = params

        // 1. Timezone & Date Context
        // Use offlineTime if provided (trusted for sync), else server time
        const checkInTime = offlineTime || new Date()

        // Get timezone from service if not provided
        const tz = timezone || await this.timezoneService.getTimezone()

        // Use timezone service to get effective date
        const { now: nowInTz, startOfDay: effectiveToday } = this.timezoneService.getEffectiveDate(tz)

        // 2. Cross-Module Validation (Leave & Holiday)
        // Check using the User's Timezone Date
        const eligibility = await this.validationService.validateCheckInEligibility(userId, tz, nowInTz)
        if (!eligibility.isValid) {
            throw new Error(`CHECKIN_REJECTED:${eligibility.reason}`) // Format error for controller to parse
        }

        // 3. User Settings & Schedule (with caching)
        const cacheKey = `user:schedule:${userId}`
        const cachedSchedule = cache.get<CachedUserAttendanceSettings>(cacheKey)

        let userDetails: CachedUserAttendanceSettings | null
        if (cachedSchedule) {
            userDetails = cachedSchedule
        } else {
            userDetails = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    startWorkTime: true,
                    endWorkTime: true,
                    workingHourMode: true,
                    attendanceGeofencePolicy: true,
                    shiftId: true,
                    shift: { select: { startTime: true, endTime: true } }
                }
            })
            // Cache for 1 hour
            if (userDetails) {
                cache.set(cacheKey, userDetails, 60)
            }
        }

        // 4. Auto-Checkout Stale Sessions
        await this.processAutoCheckout(userId, userDetails, effectiveToday, tenantId)

        // 5. Duplicate Check
        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: { gte: effectiveToday },
                ...(tenantId && { tenantId })
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
            const geofencePolicy = userDetails?.attendanceGeofencePolicy ?? 'WARN'

            if (!geoCheck.isInside && geofencePolicy === 'STRICT') {
                throw new Error('OUTSIDE_GEOFENCE')
            }

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
        const createData: Prisma.AttendanceUncheckedCreateInput = {
            id: randomUUID(),
            userId,
            tenantId,
            checkIn: checkInTime,
            checkInPhoto: photoUrl,
            location,
            notes,
            status,
            geofenceStatus: geofenceResult.status,
            geofenceDistance: geofenceResult.distance,
            geofenceSiteName: geofenceResult.siteName,
            updatedAt: new Date()
        }

        if (offlineTime) {
            createData.geofenceMeta = { offline: true, capturedAt: offlineTime.toISOString() }
        }

        return await prisma.attendance.create({
            data: createData
        })
    }

    private async processAutoCheckout(userId: string, userDetails: { endWorkTime: string | null; workingHourMode: string | null } | null, effectiveToday: Date, tenantId?: string) {
        // Skip for flexible users
        if (userDetails?.workingHourMode === 'FLEXIBLE') return

        const staleSessions = await prisma.attendance.findMany({
            where: {
                userId,
                checkOut: null,
                status: { not: 'ALPHA' },
                checkIn: { lt: effectiveToday },
                ...(tenantId && { tenantId })
            }
        })

        if (staleSessions.length === 0) return

        await Promise.all(staleSessions.map(async (session) => {
            let autoCheckOut = new Date(session.checkIn)

            // Logic Auto Checkout - same as legacy
            if (userDetails?.endWorkTime) {
                const parts = userDetails.endWorkTime.split(':').map(Number)
                const endHour = parts[0] ?? 17
                const endMinute = parts[1] ?? 0
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
        tenantId?: string
    }): Promise<{
        attendance: Prisma.AttendanceGetPayload<{ include: { user: true } }>
        warning?: string
    }> {
        const { userId, photoUrl, location, notes, latitude, longitude, offlineTime, tenantId } = params

        // 1. Find active attendance
        const attendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkOut: null,
                ...(tenantId && { tenantId })
            },
            orderBy: { checkIn: 'desc' },
            include: {
                user: {
                    select: {
                        workingHourMode: true,
                        attendanceGeofencePolicy: true,
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
            const geofencePolicy = attendance.user.attendanceGeofencePolicy ?? 'WARN'

            if (!geoCheck.isInside && geofencePolicy === 'STRICT') {
                throw new Error('OUTSIDE_GEOFENCE')
            }

            checkOutGeofenceStatus = geoCheck.isInside ? 'INSIDE' : 'OUTSIDE'
            checkOutGeofenceDistance = geoCheck.nearestDistance
        }

        // 4. Prepare notes
        const finalNotes = notes
            ? (attendance.notes ? `${attendance.notes}; Checkout Note: ${notes}` : notes)
            : attendance.notes

        // 5. Update record
        const checkOutTime = offlineTime || new Date()

        const updateData: Prisma.AttendanceUncheckedUpdateInput = {
            checkOut: checkOutTime,
            checkOutPhoto: photoUrl,
            checkOutLocation: location ?? null,
            checkOutGeofenceStatus,
            checkOutGeofenceDistance,
            notes: finalNotes,
            updatedAt: new Date()
        }

        const updatedAttendance = await prisma.attendance.update({
            where: { id: attendance.id },
            data: updateData
        })

        const result: { attendance: Prisma.AttendanceGetPayload<{ include: { user: true } }>; warning?: string } = { attendance: updatedAttendance as Prisma.AttendanceGetPayload<{ include: { user: true } }> }
        if (warning) result.warning = warning

        return result
    }

    async getReportData(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const repository = new AttendanceRepository()
        const overtimeRepository = new OvertimeRepository()
        const leaveRepository = new LeaveRepository()

        const [stats, dailyStats, groupedBySite, groupedByDept, topEmployees, userAttStats, userOtStats, topAbsentees, userTotalDuration, userAbsenceStats, userLateStats, userLeaveStats] = await Promise.all([
            repository.getStatsByDateRange(startDate, endDate, siteId, departmentId),
            repository.getDailyStats(startDate, endDate, siteId, departmentId),
            repository.getGroupedStats(startDate, endDate, 'site'),
            repository.getGroupedStats(startDate, endDate, 'department'),
            repository.getTopEmployees(startDate, endDate, 5, siteId, departmentId),
            repository.getUserAttendanceStats(startDate, endDate, siteId, departmentId),
            overtimeRepository.getUserOvertimeStats(startDate, endDate, siteId, departmentId),
            repository.getTopAbsentees(startDate, endDate, 5, siteId, departmentId),
            repository.getUserTotalDuration(startDate, endDate, siteId, departmentId),
            repository.getUserAbsenceStats(startDate, endDate, siteId, departmentId),
            repository.getUserLateStats(startDate, endDate, siteId, departmentId),
            leaveRepository.getUserLeaveStats(startDate, endDate, siteId, departmentId)
        ])

        // Calculate Combined Top Employees (Star Employees)
        const userMap = new Map<string, { days: number, officialOtMinutes: number, excessMinutes: number, totalMinutes: number, alphaCount: number }>()

        // 1. Base Attendance Days (ONLY users with actual ON_TIME/LATE attendance)
        userAttStats.forEach(item => {
            if (!userMap.has(item.userId)) userMap.set(item.userId, { days: 0, officialOtMinutes: 0, excessMinutes: 0, totalMinutes: 0, alphaCount: 0 })
            const current = userMap.get(item.userId)!
            current.days = item._count._all
        })

        // 2. Formal Overtime (Approved/Completed) - ONLY add to existing users with attendance
        userOtStats.forEach(item => {
            // Skip if user has no attendance record (shouldn't appear in Star Employees)
            if (!userMap.has(item.userId)) return
            const current = userMap.get(item.userId)!
            current.officialOtMinutes += (item._sum.duration || 0)
        })

        // 3. Absence Stats (Penalties) - ONLY for existing users
        userAbsenceStats.forEach(item => {
            if (!userMap.has(item.userId)) return
            const current = userMap.get(item.userId)!
            current.alphaCount = item._count._all
        })

        // 4. Fetch User Work Hour Configuration for accurate standard hours calculation
        const userIds = Array.from(userMap.keys())
        const userConfigs = userIds.length > 0 ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                workingHourMode: true,
                startWorkTime: true,
                endWorkTime: true,
                flexibleTargetHour: true,
                shift: {
                    select: {
                        startTime: true,
                        endTime: true
                    }
                }
            }
        }) : []

        // Create user config map for quick lookup
        const userConfigMap = new Map(userConfigs.map(u => [u.id, u]))

        // Helper function to calculate standard work minutes per day for a user
        const getStandardMinutesPerDay = (userId: string): number => {
            const config = userConfigMap.get(userId)
            if (!config) return 480 // Default 8 hours if no config found

            switch (config.workingHourMode) {
                case 'FIXED':
                    // Calculate from startWorkTime and endWorkTime (format: "HH:mm")
                    if (config.startWorkTime && config.endWorkTime) {
                        const startParts = config.startWorkTime.split(':').map(Number)
                        const endParts = config.endWorkTime.split(':').map(Number)

                        const startH = startParts[0] ?? 0
                        const startM = startParts[1] ?? 0
                        const endH = endParts[0] ?? 0
                        const endM = endParts[1] ?? 0

                        const startMinutes = startH * 60 + startM
                        const endMinutes = endH * 60 + endM
                        // Handle overnight (end < start)
                        return endMinutes >= startMinutes
                            ? endMinutes - startMinutes
                            : (24 * 60 - startMinutes) + endMinutes
                    }
                    return 480 // Default 8 hours

                case 'SHIFT':
                    // Calculate from shift times
                    if (config.shift?.startTime && config.shift?.endTime) {
                        const startParts = config.shift.startTime.split(':').map(Number)
                        const endParts = config.shift.endTime.split(':').map(Number)

                        const startH = startParts[0] ?? 0
                        const startM = startParts[1] ?? 0
                        const endH = endParts[0] ?? 0
                        const endM = endParts[1] ?? 0

                        const startMinutes = startH * 60 + startM
                        const endMinutes = endH * 60 + endM
                        // Handle overnight shift
                        return endMinutes >= startMinutes
                            ? endMinutes - startMinutes
                            : (24 * 60 - startMinutes) + endMinutes
                    }
                    return 480 // Default 8 hours

                case 'FLEXIBLE':
                    // Use flexibleTargetHour (in hours)
                    return (config.flexibleTargetHour || 8) * 60

                default:
                    return 480 // Default 8 hours
            }
        }

        // 5. Implicit Overtime & Total Duration - ONLY for existing users
        userTotalDuration.forEach((totalMinutes, userId) => {
            // Skip if user has no attendance record
            if (!userMap.has(userId)) return
            const current = userMap.get(userId)!

            // Set absolute total working minutes
            current.totalMinutes = totalMinutes

            // Calculate Standard Work Minutes based on user's ACTUAL work hour configuration
            // Only calculate excess if user has actual attendance days
            if (current.days > 0) {
                const standardMinutesPerDay = getStandardMinutesPerDay(userId)
                const standardMinutes = current.days * standardMinutesPerDay

                if (totalMinutes > standardMinutes) {
                    const excess = totalMinutes - standardMinutes
                    // Add excess minutes to record
                    current.excessMinutes += excess
                }
            }
        })

        // FILTER: Only include users with at least 1 day of attendance
        const scoredUsers = Array.from(userMap.entries())
            .filter(([_, stats]) => stats.days > 0) // Must have attendance
            .map(([userId, stats]) => {
                // Scoring System:
                // 1 Day Present = 10 pts
                // 1 Day Alpha = -20 pts (Penalty)
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
        let combinedTopEmployees: Array<{
            user: {
                id: string;
                name: string | null;
                image: string | null;
                sites: { name: string } | null;
                departments: { name: string } | null;
            } | undefined;
            score: number;
            details: Record<string, unknown>;
        }> = []

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

        // Build Employee Summary for "Rekap Karyawan" tab
        // Create maps for quick lookup
        const userLateMap = new Map(userLateStats.map(u => [u.userId, u._count._all]))
        const userLeaveMap = new Map(userLeaveStats.map(u => [u.userId, u._count._all]))
        const userAbsenceMap = new Map(userAbsenceStats.map(u => [u.userId, u._count._all]))
        const userOtMap = new Map(userOtStats.map(u => [u.userId, u._sum.duration || 0]))
        const userAttMap = new Map(userAttStats.map(u => [u.userId, u._count._all]))

        // Get all unique user IDs from all stats
        const allUserIds = new Set<string>([
            ...userAttStats.map(u => u.userId),
            ...userAbsenceStats.map(u => u.userId),
            ...userLeaveStats.map(u => u.userId)
        ])

        // Fetch all user details in one query
        const allUsers = await prisma.user.findMany({
            where: { id: { in: Array.from(allUserIds) } },
            select: {
                id: true,
                name: true,
                image: true,
                sites: { select: { id: true, name: true } },
                departments: { select: { id: true, name: true } }
            }
        })

        const userDetailsMap = new Map(allUsers.map(u => [u.id, u]))

        const employeeSummary = Array.from(allUserIds).map(userId => {
            const user = userDetailsMap.get(userId)
            const hadir = userAttMap.get(userId) || 0
            const terlambat = userLateMap.get(userId) || 0
            const izin = userLeaveMap.get(userId) || 0
            const alpha = userAbsenceMap.get(userId) || 0
            const lemburMinutes = userOtMap.get(userId) || 0
            const totalMinutes = userTotalDuration.get(userId) || 0

            return {
                userId,
                user: user ? {
                    id: user.id,
                    name: user.name,
                    image: user.image,
                    site: user.sites,
                    department: user.departments
                } : null,
                hadir,
                terlambat,
                izin,
                alpha,
                lemburJam: parseFloat((lemburMinutes / 60).toFixed(1)),
                totalJamKerja: parseFloat((totalMinutes / 60).toFixed(1))
            }
        }).filter(e => e.user !== null)

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
            topAbsentees,
            employeeSummary
        }
    }

    async getAttendanceHistory(userId: string, params: { page: number, limit: number }) {
        const { page, limit } = params
        const skip = (page - 1) * limit

        const [attendances, total] = await Promise.all([
            prisma.attendance.findMany({
                where: { userId },
                orderBy: { checkIn: 'desc' },
                take: limit,
                skip
            }),
            prisma.attendance.count({ where: { userId } })
        ])

        return {
            attendances,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        }
    }

    async getAttendanceConfig(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                sites: {
                    select: {
                        name: true,
                        latitude: true,
                        longitude: true,
                        attendanceRadius: true
                    }
                }
            }
        })

        if (!user) {
            throw new Error('USER_NOT_FOUND')
        }

        return {
            site: user.sites
        }
    }

    async getAttendanceAnalytics(userId: string, days: number = 30) {
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        const endDate = new Date()

        const userAttendances = await prisma.attendance.findMany({
            where: {
                userId,
                checkIn: { gte: startDate, lte: endDate }
            },
            orderBy: { checkIn: 'desc' }
        })

        const totalDays = userAttendances.length
        const onTimeDays = userAttendances.filter(a => a.status === 'ON_TIME').length
        const lateDays = userAttendances.filter(a => a.status === 'LATE').length

        let totalMinutes = 0
        userAttendances.forEach(att => {
            if (att.checkOut) {
                const diff = new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()
                totalMinutes += diff / (1000 * 60)
            }
        })

        const stats = {
            totalDays,
            onTimeDays,
            lateDays,
            totalWorkHours: totalMinutes / 60,
            avgWorkHours: totalDays > 0 ? (totalMinutes / 60) / totalDays : 0,
            onTimeRate: totalDays > 0 ? (onTimeDays / totalDays) * 100 : 0,
            lateRate: totalDays > 0 ? (lateDays / totalDays) * 100 : 0
        }

        const weeklyBreakdown = []
        for (let i = 0; i < 4; i++) {
            const weekStart = new Date(startDate)
            weekStart.setDate(weekStart.getDate() + (i * 7))
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 7)

            const weekAttendances = userAttendances.filter(a => {
                const checkIn = new Date(a.checkIn)
                return checkIn >= weekStart && checkIn < weekEnd
            })

            weeklyBreakdown.push({
                week: i + 1,
                startDate: weekStart,
                endDate: weekEnd,
                totalDays: weekAttendances.length,
                onTimeDays: weekAttendances.filter(a => a.status === 'ON_TIME').length,
                lateDays: weekAttendances.filter(a => a.status === 'LATE').length
            })
        }

        return {
            stats,
            weeklyBreakdown,
            recentAttendance: userAttendances.slice(0, 10),
            period: {
                startDate,
                endDate,
                days
            }
        }
    }
}
