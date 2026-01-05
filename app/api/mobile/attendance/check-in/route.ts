import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { GeofenceService } from '@/modules/attendance/services/GeofenceService'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid token' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const payload = await verifyMobileToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }

        const userId = payload.id as string

        // Fetch User and Settings first to determine Timezone
        const [userDetails, toleranceSetting, timezoneSetting] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    startWorkTime: true,
                    endWorkTime: true,
                    workingHourMode: true
                }
            }),
            prisma.settings.findFirst({
                where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' }
            }),
            prisma.settings.findFirst({
                where: { key: 'GENERAL_TIMEZONE' }
            })
        ])

        const timezone = timezoneSetting?.value || 'Asia/Jakarta'
        const toleranceMinutes = toleranceSetting?.value ? parseInt(toleranceSetting.value) : 0


        // Logic continues with request parsing...



        // Initialize optional fields
        let photoUrl = null
        let location = ''
        let notes = ''
        let latitude: number | null = null
        let longitude: number | null = null
        let offlineCapturedAt: string | null = null
        
        const contentType = request.headers.get('content-type') || ''
        
        if (contentType.includes('application/json')) {
            const body = await request.json()
            photoUrl = body.photoUrl
            location = body.location
            notes = body.notes
            latitude = body.latitude
            longitude = body.longitude
            
            // Check for offline meta
            if (body._offline_meta && body._offline_meta.capturedAt) {
                offlineCapturedAt = body._offline_meta.capturedAt
            } else if (body.capturedAt) {
                offlineCapturedAt = body.capturedAt
            }
        } else {
            const formData: any = await request.formData()
            const photo = formData.get('photo') as File
            location = formData.get('location') as string
            notes = formData.get('notes') as string
            
            // Check for offline meta in FormData (JSON string usually)
            const metaStr = formData.get('_offline_meta') as string
            if (metaStr) {
                try {
                    const meta = JSON.parse(metaStr)
                    if (meta.capturedAt) offlineCapturedAt = meta.capturedAt
                } catch (e) { /* ignore parse error */ }
            }
            
            if (photo) {
                if (!photo.type.startsWith('image/')) {
                    return NextResponse.json({ error: 'File harus berupa gambar' }, { status: 400 })
                }
    
                const MAX_SIZE = 5 * 1024 * 1024 // 5MB
                if (photo.size > MAX_SIZE) {
                    return NextResponse.json({ error: 'Ukuran foto maksimal 5MB' }, { status: 400 })
                }
    
                const dateStr = new Date().toISOString().split('T')[0]
                const uploadDir = `public/uploads/attendance/${dateStr}`
                const fileName = `${userId}_checkin_${Date.now()}`
    
                photoUrl = await convertAndSaveImage(
                    photo,
                    uploadDir,
                    fileName,
                    'employee-attendance',
                    userId
                )
            }
            const latStr = formData.get('latitude') as string
            const lngStr = formData.get('longitude') as string
            if (latStr && lngStr) {
                latitude = parseFloat(latStr)
                longitude = parseFloat(lngStr)
            }
        }

        // Determine Check-In Time
        // If offlineCapturedAt is valid, use it. Otherwise use server time.
        // SECURITY NOTE: In a real strict environment, trusting client timestamp is risky.
        // Ideally we only trust it if within a reasonable window or signed.
        // Here we trust it for offline sync purposes to avoid false penalties.
        let checkInTime = new Date()
        if (offlineCapturedAt) {
            const offlineDate = new Date(offlineCapturedAt)
            if (!isNaN(offlineDate.getTime())) {
                checkInTime = offlineDate
                // Optional: Sanity check (cannot be in future)
                if (checkInTime > new Date()) checkInTime = new Date()
            }
        }
        
        // Use checkInTime for timezone logic
        const nowInTz = new Date(checkInTime.toLocaleString('en-US', { timeZone: timezone }))
        const tzOffsetMs = nowInTz.getTime() - checkInTime.getTime()
        const startOfDayInTz = new Date(nowInTz)
        startOfDayInTz.setHours(0, 0, 0, 0)
        // Adjust effectiveToday based on checkInTime, not server 'now'
        const effectiveToday = new Date(startOfDayInTz.getTime() - tzOffsetMs)

        // Geofence validation
        let geofenceStatus = 'UNKNOWN'
        let geofenceDistance: number | null = null
        let geofenceSiteName: string | null = null
        
        if (latitude !== null && longitude !== null) {
            const geofenceService = new GeofenceService()
            const result = await geofenceService.validateGeofence(userId, latitude, longitude)
            geofenceStatus = result.isInside ? 'INSIDE' : 'OUTSIDE'
            geofenceDistance = result.nearestDistance
            geofenceSiteName = result.nearestSiteName
        }

        let status = 'ON_TIME'

        if (userDetails?.startWorkTime && userDetails?.workingHourMode !== 'FLEXIBLE') {
            const [schedHour, schedMinute] = userDetails.startWorkTime.split(':').map(Number)
            const scheduleTime = new Date(startOfDayInTz)
            scheduleTime.setHours(schedHour, schedMinute, 0, 0)
            const toleranceMs = toleranceMinutes * 60 * 1000
            const lateThreshold = new Date(scheduleTime.getTime() + toleranceMs)

            if (nowInTz > lateThreshold) {
                status = 'LATE'
            }
        }

        // Auto-Checkout Logic (remains same but uses new effectiveToday)
        const staleSessions = await prisma.attendance.findMany({
            where: {
                userId,
                checkOut: null,
                checkIn: {
                    lt: effectiveToday
                }
            }
        })

        if (staleSessions.length > 0) {
            await Promise.all(staleSessions.map(async (session) => {
                let autoCheckOut = new Date(session.checkIn)

                if (userDetails?.workingHourMode === 'FLEXIBLE') {
                    autoCheckOut.setHours(autoCheckOut.getHours() + 9)
                } else {
                    if (userDetails?.endWorkTime) {
                        const [endHour, endMinute] = userDetails.endWorkTime.split(':').map(Number)
                        autoCheckOut.setHours(endHour, endMinute, 0, 0)
                    } else {
                        autoCheckOut.setHours(17, 0, 0, 0)
                    }
                }

                if (autoCheckOut <= session.checkIn) {
                    autoCheckOut = new Date(session.checkIn.getTime() + 9 * 60 * 60 * 1000)
                }

                if (session.checkIn > autoCheckOut) {
                    autoCheckOut.setHours(23, 59, 59, 999)
                }

                const autoNote = '(Auto-Checkout: Lupa Absen Pulang)'
                const newNotes = session.notes ? `${session.notes} ${autoNote}` : autoNote

                await prisma.attendance.update({
                    where: { id: session.id },
                    data: {
                        checkOut: autoCheckOut,
                        notes: newNotes
                    }
                })
            }))
        }

        const attendance = await prisma.$transaction(async (tx) => {
            // Re-check for duplicate check-in inside transaction to prevent race conditions
            const duplicateCheck = await tx.attendance.findFirst({
                where: {
                    userId,
                    checkIn: {
                        gte: effectiveToday
                    }
                }
            })

            if (duplicateCheck) {
                throw new Error('DUPLICATE_ENTRY')
            }

            return await tx.attendance.create({
                data: {
                    id: crypto.randomUUID(),
                    userId,
                    checkIn: checkInTime,
                    checkInPhoto: photoUrl,
                    location,
                    notes,
                    status: status,
                    geofenceStatus,
                    geofenceDistance,
                    geofenceSiteName,
                    geofenceMeta: offlineCapturedAt ? { offline: true, capturedAt: offlineCapturedAt } : undefined, // Optional: store raw meta
                    updatedAt: new Date()
                }
            })
        })

        logger.apiRequest('POST', '/api/mobile/attendance/check-in', 201, Date.now() - startTime, {
            userId,
            attendanceId: attendance.id,
            status
        })

        return NextResponse.json({ success: true, data: attendance })

    } catch (error: any) {
        if (error.message === 'DUPLICATE_ENTRY') {
            return NextResponse.json({ error: 'Anda sudah melakukan check-in hari ini' }, { status: 400 })
        }
        logger.error('Error in mobile check-in', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
