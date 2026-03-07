import { NextRequest, NextResponse } from 'next/server'
import { logger, logActivitySafe } from '@/lib/logger'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { AttendanceIdempotencyService } from '@/modules/attendance/services/AttendanceIdempotencyService'
import { AttendancePhotoService } from '@/modules/attendance/services/AttendancePhotoService'
import { validateCoordinates } from '@/lib/validation-utils'
import { verifySignature } from '@/lib/crypto'

export async function POST(request: NextRequest) {
    const _startTime = Date.now()
    let userId: string | null = null
    let resolvedRequestId: string | null = null

    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({
                error: 'Token hilang atau tidak valid',
                code: 'UNAUTHORIZED'
            }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        if (!token) {
            return NextResponse.json({ error: 'Token tidak tersedia' }, { status: 401 })
        }
        const payload = await verifyMobileToken(token)
        if (!payload) {
            return NextResponse.json({
                error: 'Token tidak valid atau kadaluarsa',
                code: 'UNAUTHORIZED'
            }, { status: 401 })
        }

        userId = (payload.userId || payload.id) as string
        let bodyRequestId: string | undefined

        if (!userId) {
            return NextResponse.json({
                error: 'Struktur token tidak valid',
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
            const body = await request.json() as {
              location: string;
              notes: string;
              photoUrl?: string;
              latitude?: number;
              longitude?: number;
              requestId?: string;
              _offline_meta?: { capturedAt?: string; signature?: string };
            }
            location = body.location
            notes = body.notes
            bodyRequestId = body.requestId

            // Handle photoUrl from trusted CDN or relative path
            if (body.photoUrl) {
                // SECURITY: Accept relative paths from our upload endpoint
                // OR full URLs from trusted CDN domains
                if (body.photoUrl.startsWith('/uploads/')) {
                    // Relative path from our own upload endpoint - trusted
                    photoUrl = body.photoUrl
                } else {
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
                        error: 'Data offline harus ditandatangani',
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
                        error: 'Tanda tangan data offline tidak valid',
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
            const formData = await request.formData()
            const photo = formData.get('photo') as File | null
            notes = formData.get('notes') as string || ''
            location = formData.get('location') as string || ''
            const requestIdValue = formData.get('requestId')

            if (typeof requestIdValue === 'string') {
                bodyRequestId = requestIdValue
            }

            if (photo) {
                const photoService = new AttendancePhotoService()
                try {
                    photoUrl = await photoService.processPhoto(photo, userId, 'checkout')
                } catch (error: unknown) {
                    return NextResponse.json({
                        error: error instanceof Error ? error.message : 'Unknown photo processing error',
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
        const idempotencyService = new AttendanceIdempotencyService()

        resolvedRequestId = idempotencyService.resolveRequestId(
            request.headers.get('Idempotency-Key') ?? request.headers.get('idempotency-key'),
            bodyRequestId
        )

        let payloadHash: string | null = null

        if (resolvedRequestId) {
            payloadHash = idempotencyService.buildPayloadHash({
                location,
                notes,
                latitude,
                longitude,
                photoUrl,
                offlineTime: offlineTime?.toISOString() ?? null,
            })

            const beginState = await idempotencyService.begin(userId, 'check-out', resolvedRequestId, payloadHash)

            if (beginState === 'completed') {
                const replayPayload = await idempotencyService.getReplay<{ success: boolean; data: unknown; warning?: string }>(
                    userId,
                    'check-out',
                    resolvedRequestId
                )

                if (replayPayload) {
                    return NextResponse.json(replayPayload, {
                        headers: { 'X-Idempotent-Replay': 'true' }
                    })
                }
            }

            if (beginState === 'hash-mismatch') {
                return NextResponse.json({
                    error: 'Idempotency key sudah digunakan untuk payload berbeda',
                    code: 'IDEMPOTENCY_KEY_REUSED'
                }, { status: 409 })
            }

            if (beginState === 'in-progress') {
                return NextResponse.json({
                    error: 'Permintaan check-out sedang diproses',
                    code: 'REQUEST_IN_PROGRESS'
                }, { status: 409 })
            }
        }

        try {
            const checkOutParams: {
              userId: string;
              photoUrl: string | null;
              location: string;
              notes: string;
              latitude?: number;
              longitude?: number;
              offlineTime?: Date;
            } = {
                userId,
                photoUrl,
                location,
                notes,
            }
            if (latitude !== undefined) checkOutParams.latitude = latitude
            if (longitude !== undefined) checkOutParams.longitude = longitude
            if (offlineTime) checkOutParams.offlineTime = offlineTime

            const result = await attendanceService.checkOut(checkOutParams)

            // System Log
            logActivitySafe({
                action: 'CHECK_OUT',
                subject: 'Attendance',
                userId,
                details: {
                    attendanceId: result.attendance.id,
                    location,
                    isOffline: !!offlineTime
                }
            })

            const responsePayload = {
                success: true,
                data: result.attendance,
                ...(result.warning && { warning: result.warning })
            }

            if (resolvedRequestId && payloadHash) {
                await idempotencyService.complete(userId, 'check-out', resolvedRequestId, payloadHash, responsePayload)
            }

            return NextResponse.json(responsePayload)
        } catch (error: unknown) {
            if (error instanceof Error && error.message === 'OUTSIDE_GEOFENCE') {
                return NextResponse.json({
                    error: 'Anda berada di luar area absensi yang diizinkan',
                    code: 'OUTSIDE_GEOFENCE'
                }, { status: 400 })
            }
            if (error instanceof Error && error.message === 'NO_ACTIVE_SESSION') {
                return NextResponse.json({
                    error: 'Anda belum melakukan check-in atau sudah check-out hari ini',
                    code: 'NO_ACTIVE_SESSION'
                }, { status: 400 })
            }
            throw error
        }

    } catch (error: unknown) {
        if (userId && resolvedRequestId) {
            const idempotencyService = new AttendanceIdempotencyService()
            await idempotencyService.release(userId, 'check-out', resolvedRequestId)
        }

        logger.error('Error in mobile check-out', error as Error)
        return NextResponse.json({
            error: 'Terjadi kesalahan server',
            code: 'INTERNAL_ERROR'
        }, { status: 500 })
    }
}
