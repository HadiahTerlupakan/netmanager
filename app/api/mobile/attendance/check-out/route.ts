import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { AttendancePhotoService } from '@/modules/attendance/services/AttendancePhotoService'
import { validateCoordinates } from '@/lib/validation-utils'
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

        const userId = (payload.userId || payload.id) as string
        if (!userId) {
            return NextResponse.json({
                error: 'Invalid token structure',
                code: 'UNAUTHORIZED'
            }, { status: 401 })
        }

        let photoUrl: string | null = null
        let notes = ''
        let location = ''
        let latitude: number | undefined
        let longitude: number | undefined
        let offlineTime: Date | undefined
        
        const contentType = request.headers.get('content-type') || ''
        
        if (contentType.includes('application/json')) {
            const body = await request.json()
            location = body.location
            notes = body.notes
            
            // Handle photoUrl from trusted CDN
            if (body.photoUrl) {
                const trustedDomains = ['cdn.radpro.id', 'localhost:3000', '0.0.0.0:3000']
                try {
                    const url = new URL(body.photoUrl)
                    const isTrusted = trustedDomains.some(domain => 
                        url.host === domain || url.host.endsWith('.' + domain)
                    )
                    if (isTrusted) {
                        photoUrl = body.photoUrl
                    }
                } catch {
                    // Invalid URL, ignore
                }
            }
            
            // Validate coordinates using centralized utility
            if (body.latitude !== undefined && body.longitude !== undefined) {
                const coordValidation = validateCoordinates(body.latitude, body.longitude)
                if (!coordValidation.valid) {
                    return NextResponse.json({
                        error: coordValidation.error,
                        code: coordValidation.code
                    }, { status: 400 })
                }
                latitude = coordValidation.latitude
                longitude = coordValidation.longitude
            }

            // Signature verification for offline data
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

                const dt = new Date(body._offline_meta.capturedAt)
                if (!isNaN(dt.getTime())) {
                    offlineTime = dt
                }
            }
        } else {
            // FormData handling
            const formData: any = await request.formData()
            const photo = formData.get('photo') as File | null
            notes = formData.get('notes') as string || ''
            location = formData.get('location') as string || ''
            
            if (photo) {
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

            // Parse coordinates from formData
            const latStr = formData.get('latitude') as string
            const lngStr = formData.get('longitude') as string
            if (latStr && lngStr) {
                const coordValidation = validateCoordinates(latStr, lngStr)
                if (!coordValidation.valid) {
                    return NextResponse.json({
                        error: coordValidation.error,
                        code: coordValidation.code
                    }, { status: 400 })
                }
                latitude = coordValidation.latitude
                longitude = coordValidation.longitude
            }
        }

        // Use centralized service
        const attendanceService = new AttendanceService()
        try {
            const result = await attendanceService.checkOut({
                userId,
                photoUrl,
                location,
                notes,
                latitude,
                longitude,
                offlineTime
            })

            // System Log
            try {
                await logger.logActivity({
                    action: 'CHECK_OUT',
                    subject: 'Attendance',
                    userId,
                    details: { 
                        attendanceId: result.attendance.id, 
                        location,
                        isOffline: !!offlineTime 
                    }
                })
            } catch (e) { console.error('Logging check-out failed', e) }

            return NextResponse.json({ 
                success: true, 
                data: result.attendance,
                ...(result.warning && { warning: result.warning })
            })
        } catch (error: any) {
            if (error.message === 'NO_ACTIVE_SESSION') {
                return NextResponse.json({
                    error: 'Anda belum melakukan check-in atau sudah check-out hari ini',
                    code: 'NO_ACTIVE_SESSION'
                }, { status: 400 })
            }
            throw error
        }

    } catch (error: any) {
        logger.error('Error in mobile check-out', error)
        return NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        }, { status: 500 })
    }
}

