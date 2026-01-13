import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { GeofenceService } from '@/modules/attendance/services/GeofenceService'
import { AttendancePhotoService } from '@/modules/attendance/services/AttendancePhotoService'
import { verifySignature } from '@/lib/crypto'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({
                error: 'Missing or invalid token',
                code: 'UNAUTHORIZED'
            }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const payload = await verifyMobileToken(token)
        if (!payload) {
            return NextResponse.json({
                error: 'Invalid or expired token',
                code: 'UNAUTHORIZED'
            }, { status: 401 })
        }

        // Standarisasi userId extraction - konsisten dengan check-in route
        const userId = (payload.userId || payload.id) as string
        if (!userId) {
            return NextResponse.json({
                error: 'Invalid token structure',
                code: 'UNAUTHORIZED'
            }, { status: 401 })
        }

        // Search for active attendance (last 24 hours)
        const searchStart = new Date()
        searchStart.setHours(searchStart.getHours() - 24)

        const attendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: { gte: searchStart },
                checkOut: null
            },
            orderBy: {
                checkIn: 'desc'
            },
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
            return NextResponse.json({
                error: 'Anda belum melakukan check-in atau sudah check-out hari ini',
                code: 'NO_ACTIVE_SESSION'
            }, { status: 400 })
        }

        // Calculate working duration for FLEXIBLE users
        let workDurationWarning: string | null = null
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
                
                workDurationWarning = `Jam kerja Anda baru ${workedHours} jam ${workedMinutes} menit. Target kerja: ${targetHours} jam. Kurang ${remainingHoursInt} jam ${remainingMinutes} menit.`
            }
        }

        let photoUrl = null
        let notes = ''
        let location = ''
        let latitude: number | null = null
        let longitude: number | null = null
        
        const contentType = request.headers.get('content-type') || ''
        
        if (contentType.includes('application/json')) {
            const body = await request.json()
            photoUrl = body.photoUrl
            notes = body.notes
            location = body.location
            
            // Validate coordinates if provided
            if (body.latitude !== undefined && body.longitude !== undefined) {
                const lat = parseFloat(body.latitude)
                const lng = parseFloat(body.longitude)

                if (isNaN(lat) || isNaN(lng)) {
                    return NextResponse.json({
                        error: 'Koordinat tidak valid',
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }

                if (lat < -90 || lat > 90) {
                    return NextResponse.json({
                        error: 'Latitude harus antara -90 dan 90',
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }

                if (lng < -180 || lng > 180) {
                    return NextResponse.json({
                        error: 'Longitude harus antara -180 dan 180',
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }

                latitude = lat
                longitude = lng
            }

            // Signature verification untuk offline data (konsisten dengan check-in)
            if (body._offline_meta?.capturedAt) {
                if (!body._offline_meta.signature) {
                    return NextResponse.json({
                        error: 'Offline data must be signed',
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }
                
                const dataToVerify = {
                    userId,
                    timestamp: body._offline_meta.capturedAt,
                    latitude,
                    longitude
                }
                if (!verifySignature(dataToVerify, body._offline_meta.signature)) {
                    return NextResponse.json({
                        error: 'Invalid offline data signature',
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }
            }
        } else {
            const formData: any = await request.formData()
            const photo = formData.get('photo') as File | null
            notes = formData.get('notes') as string
            location = formData.get('location') as string
            
            if (photo) {
                // Process photo using centralized service
                const photoService = new AttendancePhotoService()
                try {
                    photoUrl = await photoService.processPhoto(photo, userId, 'checkout')
                } catch (error: any) {
                    return NextResponse.json({
                        error: error.message,
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }
            }

            // Parse latitude/longitude from formData
            const latStr = formData.get('latitude') as string
            const lngStr = formData.get('longitude') as string
            if (latStr && lngStr) {
                const lat = parseFloat(latStr)
                const lng = parseFloat(lngStr)

                // Validate coordinates
                if (isNaN(lat) || isNaN(lng)) {
                    return NextResponse.json({
                        error: 'Koordinat tidak valid',
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }

                if (lat < -90 || lat > 90) {
                    return NextResponse.json({
                        error: 'Latitude harus antara -90 dan 90',
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }

                if (lng < -180 || lng > 180) {
                    return NextResponse.json({
                        error: 'Longitude harus antara -180 dan 180',
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }

                latitude = lat
                longitude = lng
            }
        }

        // Geofence validation
        let checkOutGeofenceStatus = 'UNKNOWN'
        let checkOutGeofenceDistance: number | null = null
        
        if (latitude !== null && longitude !== null) {
            const geofenceService = new GeofenceService()
            const result = await geofenceService.validateGeofence(userId, latitude, longitude)
            checkOutGeofenceStatus = result.isInside ? 'INSIDE' : 'OUTSIDE'
            checkOutGeofenceDistance = result.nearestDistance
        }

        const updatedAttendance = await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
                checkOut: new Date(),
                checkOutPhoto: photoUrl,
                checkOutLocation: location || undefined,
                checkOutGeofenceStatus,
                checkOutGeofenceDistance,
                notes: notes ? (attendance.notes ? `${attendance.notes}; Checkout Note: ${notes}` : notes) : undefined,
                updatedAt: new Date()
            }
        })

        logger.apiRequest('POST', '/api/mobile/attendance/check-out', 200, Date.now() - startTime, {
            userId,
            attendanceId: updatedAttendance.id
        })

        return NextResponse.json({ 
            success: true, 
            data: updatedAttendance,
            ...(workDurationWarning && { warning: workDurationWarning })
        })

    } catch (error: any) {
        logger.error('Error in mobile check-out', error)
        return NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        }, { status: 500 })
    }
}
