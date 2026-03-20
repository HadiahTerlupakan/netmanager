import { NextRequest, NextResponse } from 'next/server'
import { apiError, apiSuccess, ErrorCodes } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { logger, logActivitySafe } from '@/lib/logger'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { AttendanceIdempotencyService } from '@/modules/attendance/services/AttendanceIdempotencyService'
import { AttendancePhotoService } from '@/modules/attendance/services/AttendancePhotoService'
import { verifySignature } from '@/lib/crypto'

export async function POST(request: NextRequest) {
    let userId: string | null = null
    let resolvedRequestId: string | null = null

    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        userId = authResult.id as string
        const tenantId = authResult.tenantId as string
        let bodyRequestId: string | undefined

        // Fetch Settings first to determine Timezone
        const [toleranceSetting, timezoneSetting] = await Promise.all([
            prisma.settings.findFirst({
                where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' , tenantId }
            }),
            prisma.settings.findFirst({
                where: { key: 'GENERAL_TIMEZONE' , tenantId }
            })
        ])

        const timezone = timezoneSetting?.value || 'Asia/Jakarta'
        const _toleranceMinutes = toleranceSetting?.value ? parseInt(toleranceSetting.value) : 0


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
            const formData = await request.formData()

            const photo = formData.get('photo') as File
            location = formData.get('location') as string
            notes = formData.get('notes') as string
            const latStr = formData.get('latitude') as string
            const lngStr = formData.get('longitude') as string
            const requestIdValue = formData.get('requestId')

            if (typeof requestIdValue === 'string') {
                bodyRequestId = requestIdValue
            }

            if (latStr && lngStr) {
                const lat = parseFloat(latStr)
                const lng = parseFloat(lngStr)

                // Validate coordinates
                if (isNaN(lat) || isNaN(lng)) {
                    return apiError('Koordinat tidak valid', ErrorCodes.INVALID_COORDINATES, { status: 400 })
                }

                if (lat < -90 || lat > 90) {
                    return apiError('Latitude harus antara -90 dan 90', ErrorCodes.INVALID_COORDINATES, { status: 400 })
                }

                if (lng < -180 || lng > 180) {
                    return apiError('Longitude harus antara -180 dan 180', ErrorCodes.INVALID_COORDINATES, { status: 400 })
                }

                latitude = lat
                longitude = lng
            }

            // Check for offline meta in FormData (JSON string usually)
            const metaStr = formData.get('_offline_meta') as string
            if (metaStr) {
                try {
                    const meta = JSON.parse(metaStr) as { capturedAt?: string; signature?: string }
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
                                    return apiError('Tanda tangan data offline tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                                }
                            } else {
                                return apiError('Data offline harus ditandatangani', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                            }
                        }
                    }
                } catch (_e) {
                    // Error parsing offline meta, will continue without it
                }
            }

            if (photo) {
                // Process photo using centralized service
                const photoService = new AttendancePhotoService()
                try {
                    photoUrl = await photoService.processPhoto(photo, userId, 'checkin')
                } catch (error: unknown) {
                    return apiError(error instanceof Error ? error.message : 'Unknown photo processing error', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                }
            }
        } else if (contentType.includes('application/json')) {
            const body = await request.json() as {
                location: string;
                notes: string;
                latitude?: number;
                longitude?: number;
                photoUrl?: string;
                requestId?: string;
                capturedAt?: string;
                _offline_meta?: { capturedAt?: string; signature?: string }
            }
            location = body.location
            notes = body.notes
            bodyRequestId = body.requestId

            // Validate coordinates using centralized utility
            if (body.latitude !== undefined && body.longitude !== undefined) {
                const { validateCoordinates } = await import('@/lib/validation-utils')
                const coordValidation = validateCoordinates(body.latitude, body.longitude)

                if (!coordValidation.valid) {
                    return apiError(coordValidation.error ?? 'Koordinat tidak valid', ErrorCodes.INVALID_COORDINATES, { status: 400 })
                }

                latitude = coordValidation.latitude!
                longitude = coordValidation.longitude!
            }

            // Handle photoUrl - validate it's from trusted source
            if (body.photoUrl) {
                // SECURITY: Accept relative paths from our upload endpoint
                // OR full URLs from trusted CDN domains
                if (body.photoUrl.startsWith('/uploads/')) {
                    // Relative path from our own upload endpoint - trusted
                    photoUrl = body.photoUrl
                } else {
                    // Full URL - validate against trusted domains
                    const host = request.headers.get('host')
                    const trustedDomains = [
                        'cdn.radpro.id',
                        'localhost:3000',
                        '0.0.0.0:3000',
                        'localhost'
                    ]
                    if (host) {
                        trustedDomains.push(host)
                        trustedDomains.push(host.split(':')[0]) // push hostname without port just in case
                    }

                    try {
                        // Dynamically add R2 domain if enabled
                        const { getR2Settings } = await import('@/lib/utils/r2-client')
                        const r2Settings = await getR2Settings()
                        if (r2Settings?.enabled) {
                            if (r2Settings.publicUrl) {
                                try {
                                    const r2Url = new URL(r2Settings.publicUrl)
                                    trustedDomains.push(r2Url.host)
                                    trustedDomains.push(r2Url.hostname)
                                } catch (_e) {
                                    // ignore invalid public url format
                                }
                            } else {
                                // Default R2 dev url format
                                trustedDomains.push(`${r2Settings.bucketName}.${r2Settings.accountId}.r2.cloudflarestorage.com`)
                            }
                        }
                    } catch (_e) {
                        // Optional fallback if r2-client fails
                    }

                    try {
                        const url = new URL(body.photoUrl)
                        const isLocalIP = process.env.NODE_ENV !== 'production' &&
                            (/^(192\.168|10|127|172\.(1[6-9]|2[0-9]|3[0-1]))\./.test(url.hostname));

                        const isTrusted = isLocalIP || trustedDomains.some(domain =>
                            url.host === domain || url.hostname === domain || url.host.endsWith('.' + domain)
                        )

                        if (isTrusted) {
                            // PhotoUrl from our CDN is trusted (already uploaded via /api/mobile/upload)
                            photoUrl = body.photoUrl
                        } else {
                            // External URL not trusted - log warning but don't expose URL in log
                            logger.warn(`[SECURITY] Untrusted photoUrl rejected for user ${userId}`)
                            return apiError('Photo URL tidak valid. Upload foto melalui endpoint yang benar.', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                        }
                    } catch {
                        // Invalid URL format
                        return apiError('Format Photo URL tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                    }
                }
            }

            // Check for offline meta
            if (body._offline_meta && body._offline_meta.capturedAt) {
                const dt = new Date(body._offline_meta.capturedAt)
                if (!isNaN(dt.getTime())) {
                    offlineCapturedAt = dt

                    // Verify Signature - Enforce for all offline data
                    if (!body._offline_meta.signature) {
                        return apiError('Data offline harus ditandatangani', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                    }

                    const dataToVerify = {
                        userId,
                        timestamp: body._offline_meta.capturedAt,
                        latitude: latitude,
                        longitude: longitude
                    }
                    if (!verifySignature(dataToVerify, body._offline_meta.signature)) {
                    return apiError('Tanda tangan data offline tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                    }
                }
            } else if (body.capturedAt) {
                const dt = new Date(body.capturedAt)
                if (!isNaN(dt.getTime())) offlineCapturedAt = dt
            }
        }


        // --- Use Centralized Service ---
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
                offlineTime: offlineCapturedAt?.toISOString() ?? null,
                timezone,
            })

            const beginState = await idempotencyService.begin(userId, 'check-in', resolvedRequestId, payloadHash)

            if (beginState === 'completed') {
                const replayPayload = await idempotencyService.getReplay<{ success: boolean; data: unknown }>(
                    userId,
                    'check-in',
                    resolvedRequestId
                )

                if (replayPayload) {
                    return apiSuccess(replayPayload, {
                        headers: { 'X-Idempotent-Replay': 'true' }
                    })
                }
            }

            if (beginState === 'hash-mismatch') {
                return apiError('Idempotency key sudah digunakan untuk payload berbeda', ErrorCodes.CONFLICT, { status: 409 })
            }

            if (beginState === 'in-progress') {
                return apiError('Permintaan check-in sedang diproses', ErrorCodes.CONFLICT, { status: 409 })
            }
        }

        const checkInParams: {
            userId: string;
            photoUrl: string | null;
            location: string;
            notes: string;
            timezone: string;
            latitude?: number;
            longitude?: number;
            offlineTime?: Date;
            tenantId?: string;
        } = {
            userId,
            photoUrl,
            location,
            notes,
            timezone, // Use fetched user timezone preference
            tenantId
        }
        if (latitude !== undefined) checkInParams.latitude = latitude
        if (longitude !== undefined) checkInParams.longitude = longitude
        if (offlineCapturedAt) checkInParams.offlineTime = offlineCapturedAt

        const attendance = await attendanceService.checkIn(checkInParams)

        // System Log
        logActivitySafe({
            action: 'CHECK_IN',
            subject: 'Attendance',
            userId,
            details: {
                attendanceId: attendance.id,
                status: attendance.status,
                location,
                isOffline: !!offlineCapturedAt
            }
        })

        const responsePayload = { success: true, data: attendance }

        if (resolvedRequestId && payloadHash) {
            await idempotencyService.complete(userId, 'check-in', resolvedRequestId, payloadHash, responsePayload)
        }

        return apiSuccess(attendance)

    } catch (error: unknown) {
        if (userId && resolvedRequestId) {
            const idempotencyService = new AttendanceIdempotencyService()
            await idempotencyService.release(userId, 'check-in', resolvedRequestId)
        }

        if (error instanceof Error) {
            if (error.message === 'OUTSIDE_GEOFENCE') {
                return apiError('Anda berada di luar area absensi yang diizinkan', ErrorCodes.OUTSIDE_GEOFENCE, { status: 400 })
            }
            if (error.message === 'DUPLICATE_ENTRY') {
                return apiError('Anda sudah melakukan check-in hari ini', ErrorCodes.ALREADY_CHECKED_IN, { status: 400 })
            }
            if (error.message.startsWith('CHECKIN_REJECTED:')) {
                const reason = error.message.split(':')[1]
                return apiError(`Check-in ditolak: ${reason}`, ErrorCodes.VALIDATION_ERROR, { status: 400, details: { reason } })
            }
        }

        logger.error('Error in mobile check-in', error as Error)
        return apiError('Terjadi kesalahan server', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
