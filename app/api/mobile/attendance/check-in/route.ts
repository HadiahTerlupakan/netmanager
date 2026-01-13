import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { AttendancePhotoService } from '@/modules/attendance/services/AttendancePhotoService'
import { verifySignature } from '@/lib/crypto'
import { ATTENDANCE_CONSTANTS } from '@/lib/attendance-constants'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const authHeader = request.headers.get('authorization')

        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const decoded = await verifyMobileToken(token)

        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const userId = decoded.userId as string

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
        let latitude: number | undefined
        let longitude: number | undefined
        let offlineCapturedAt: Date | undefined
        
        const contentType = request.headers.get('content-type') || ''
        
        if (contentType.includes('multipart/form-data')) {
            const formData: any = await request.formData()

            const photo = formData.get('photo') as File
            location = formData.get('location') as string
            notes = formData.get('notes') as string
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
            
            // Check for offline meta in FormData (JSON string usually)
            const metaStr = formData.get('_offline_meta') as string
            if (metaStr) {
                try {
                    const meta = JSON.parse(metaStr)
                    if (meta.capturedAt) {
                        const dt = new Date(meta.capturedAt)
                        if (!isNaN(dt.getTime())) {
                             offlineCapturedAt = dt
                             
                             // Verify Signature for FormData
                             if (meta.signature) {
                                  const dataToVerify = {
                                      userId,
                                      timestamp: meta.capturedAt,
                                      latitude,
                                      longitude
                                  }
                                  if (!verifySignature(dataToVerify, meta.signature)) {
                                      return NextResponse.json({
                                          error: 'Invalid offline data signature',
                                          code: 'VALIDATION_ERROR'
                                      }, { status: 400 })
                                  }
                             } else {
                                 return NextResponse.json({
                                     error: 'Offline data must be signed',
                                     code: 'VALIDATION_ERROR'
                                 }, { status: 400 })
                             }
                        }
                    }
                } catch (e) {
                    // Error parsing offline meta, will continue without it
                }
            }
            
            if (photo) {
                // Process photo using centralized service
                const photoService = new AttendancePhotoService()
                try {
                    photoUrl = await photoService.processPhoto(photo, userId, 'checkin')
                } catch (error: any) {
                    return NextResponse.json({
                        error: error.message,
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }
            }
        } else if (contentType.includes('application/json')) {
            const body = await request.json()
            photoUrl = body.photoUrl
            location = body.location
            notes = body.notes
            
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
            
            // Check for offline meta
            if (body._offline_meta && body._offline_meta.capturedAt) {
                const dt = new Date(body._offline_meta.capturedAt)
                if (!isNaN(dt.getTime())) {
                    offlineCapturedAt = dt
                    
                    // Verify Signature - Enforce for all offline data
                    if (!body._offline_meta.signature) {
                        return NextResponse.json({
                            error: 'Offline data must be signed',
                            code: 'VALIDATION_ERROR'
                        }, { status: 400 })
                    }
                    
                    const dataToVerify = {
                        userId,
                        timestamp: body._offline_meta.capturedAt,
                        latitude: latitude,
                        longitude: longitude
                    }
                    if (!verifySignature(dataToVerify, body._offline_meta.signature)) {
                         return NextResponse.json({
                             error: 'Invalid offline data signature',
                             code: 'VALIDATION_ERROR'
                         }, { status: 400 })
                    }
                }
            } else if (body.capturedAt) {
                 const dt = new Date(body.capturedAt)
                 if (!isNaN(dt.getTime())) offlineCapturedAt = dt
            }
        }

        // --- Use Centralized Service ---
        const attendanceService = new AttendanceService()
        const attendance = await attendanceService.checkIn({
            userId,
            photoUrl,
            location,
            notes,
            latitude,
            longitude,
            offlineTime: offlineCapturedAt,
            timezone // Use fetched user timezone preference
        })
        
        logger.apiRequest('POST', '/api/mobile/attendance/check-in', 201, Date.now() - startTime, {
            userId,
            attendanceId: attendance.id,
            status: attendance.status
        })

        return NextResponse.json({ success: true, data: attendance })

    } catch (error: any) {
        if (error.message === 'DUPLICATE_ENTRY') {
            return NextResponse.json({
                error: 'Anda sudah melakukan check-in hari ini',
                code: 'DUPLICATE_ENTRY'
            }, { status: 400 })
        }
        if (error.message.startsWith('CHECKIN_REJECTED:')) {
            const reason = error.message.split(':')[1]
            return NextResponse.json({
                error: `Check-in ditolak: ${reason}`,
                code: 'VALIDATION_ERROR',
                details: { reason }
            }, { status: 400 })
        }

        logger.error('Error in mobile check-in', error)
        return NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        }, { status: 500 })
    }
}
