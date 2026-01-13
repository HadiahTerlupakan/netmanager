import { prisma } from '@/lib/prisma'
import { GeofenceService } from './GeofenceService'
import { AttendanceValidationService } from './AttendanceValidationService'
import { AttendanceStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

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

    constructor() {
        this.geofenceService = new GeofenceService()
        this.validationService = new AttendanceValidationService()
    }

    async checkIn(params: CheckInParams) {
        const { userId, photoUrl, location, notes, latitude, longitude, offlineTime, timezone = 'Asia/Jakarta' } = params

        // 1. Timezone & Date Context
        // Use offlineTime if provided (trusted for sync), else server time
        const checkInTime = offlineTime || new Date()
        
        // Convert to Target Timezone to determine "Today" logic
        const nowInTz = new Date(checkInTime.toLocaleString('en-US', { timeZone: timezone }))
        const tzOffsetMs = nowInTz.getTime() - checkInTime.getTime()
        
        const startOfDayInTz = new Date(nowInTz)
        startOfDayInTz.setHours(0, 0, 0, 0)
        
        // Effective UTC time for 00:00 in user's timezone
        const effectiveToday = new Date(startOfDayInTz.getTime() - tzOffsetMs)

        // 2. Cross-Module Validation (Leave & Holiday)
        // Check using the User's Timezone Date
        const eligibility = await this.validationService.validateCheckInEligibility(userId, nowInTz)
        if (!eligibility.isValid) {
            throw new Error(`CHECKIN_REJECTED:${eligibility.reason}`) // Format error for controller to parse
        }

        // 3. User Settings & Schedule
        const [userDetails, toleranceSetting] = await Promise.all([
            prisma.user.findUnique({ 
                where: { id: userId },
                select: { startWorkTime: true, endWorkTime: true, workingHourMode: true } 
            }),
            prisma.settings.findFirst({ where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' } })
        ])

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
        if (userDetails?.startWorkTime && userDetails?.workingHourMode !== 'FLEXIBLE') {
            const [schedHour, schedMinute] = userDetails.startWorkTime.split(':').map(Number)
            const scheduleTime = new Date(startOfDayInTz)
            scheduleTime.setHours(schedHour, schedMinute, 0, 0)
            
            const toleranceMinutes = toleranceSetting?.value ? parseInt(toleranceSetting.value) : 0
            const lateThreshold = new Date(scheduleTime.getTime() + (toleranceMinutes * 60000))

            if (nowInTz > lateThreshold) {
                status = 'LATE'
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
                // Fallback: CheckIn + 9 hours
                autoCheckOut = new Date(session.checkIn.getTime() + 9 * 3600000)
            }
            
            // Logic "Malam" -> 23:59
            if (session.checkIn > autoCheckOut) {
                autoCheckOut.setHours(23, 59, 59, 999)
            }

            const autoNote = '(Auto-Checkout: Lupa Absen Pulang)'
            const newNotes = session.notes ? `${session.notes} ${autoNote}` : autoNote

            await prisma.attendance.update({
                where: { id: session.id },
                data: { checkOut: autoCheckOut, notes: newNotes }
            })
        }))
    }

    async getReportData(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const attendanceData = await prisma.attendance.findMany({
            where: {
                checkIn: {
                    gte: startDate,
                    lte: endDate
                },
                user: {
                    siteId: siteId,
                    departmentId: departmentId
                }
            },
            include: {
                user: {
                    select: {
                        name: true,
                        role: true,
                        departments: { select: { name: true } },
                        sites: { select: { name: true } }
                    }
                }
            },
            orderBy: {
                checkIn: 'asc'
            }
        })
        return attendanceData
    }
}
