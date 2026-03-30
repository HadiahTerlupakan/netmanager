import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { AttendanceIdempotencyService } from '@/modules/attendance/services/AttendanceIdempotencyService'
import { AttendancePhotoService } from '@/modules/attendance/services/AttendancePhotoService'
import { validateCoordinates } from '@/lib/validation-utils'
import { verifySignature } from '@/lib/crypto'
import { apiSuccess, apiError, ErrorCodes, createHandler } from '@/lib/api'

export const POST = createHandler({ auth: true }, async (request, ctx) => {
    const userSession = ctx.session!.user
    const userId = userSession.id
    const tenantId = userSession.tenantId as string
    let resolvedRequestId: string | null = null

    try {
        let bodyRequestId: string | undefined
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
            bodyRequestId = body.requestId

            if (body.photoUrl) {
                if (body.photoUrl.startsWith('/uploads/')) {
                    photoUrl = body.photoUrl
                } else {
                    const trustedDomains = ['cdn.radpro.id', 'localhost:3000', '0.0.0.0:3000']
                    try {
                        const url = new URL(body.photoUrl)
                        if (trustedDomains.some(domain => url.host === domain || url.host.endsWith('.' + domain))) {
                            photoUrl = body.photoUrl
                        }
                    } catch {}
                }
            }

            if (body.latitude !== undefined && body.longitude !== undefined) {
                const coordValidation = validateCoordinates(body.latitude, body.longitude)
                if (!coordValidation.valid) return apiError(coordValidation.error ?? 'Koordinat tidak valid', ErrorCodes.INVALID_COORDINATES, { status: 400 })
                latitude = coordValidation.latitude
                longitude = coordValidation.longitude
            }

            if (body._offline_meta?.capturedAt) {
                if (!body._offline_meta.signature) return apiError('Data offline harus ditandatangani', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                if (!verifySignature({ userId, timestamp: body._offline_meta.capturedAt, latitude, longitude }, body._offline_meta.signature)) {
                    return apiError('Tanda tangan data offline tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                }
                const dt = new Date(body._offline_meta.capturedAt)
                if (!isNaN(dt.getTime())) offlineTime = dt
            }
            ctx.validated = body
        } else {
            const formData = await request.formData()
            const photo = formData.get('photo') as File | null
            notes = formData.get('notes') as string || ''
            location = formData.get('location') as string || ''
            const requestIdValue = formData.get('requestId')
            if (typeof requestIdValue === 'string') bodyRequestId = requestIdValue

            if (photo) {
                const photoService = new AttendancePhotoService()
                photoUrl = await photoService.processPhoto(photo, userId, 'checkout')
            }

            const latStr = formData.get('latitude') as string
            const lngStr = formData.get('longitude') as string
            if (latStr && lngStr) {
                const coordValidation = validateCoordinates(latStr, lngStr)
                if (!coordValidation.valid) return apiError(coordValidation.error ?? 'Koordinat tidak valid', ErrorCodes.INVALID_COORDINATES, { status: 400 })
                latitude = coordValidation.latitude
                longitude = coordValidation.longitude
            }

            const metaStr = formData.get('_offline_meta') as string
            if (metaStr) {
                try {
                    const meta = JSON.parse(metaStr) as { capturedAt?: string; signature?: string }
                    if (meta.capturedAt) {
                        const dt = new Date(meta.capturedAt)
                        if (!isNaN(dt.getTime())) {
                            offlineTime = dt
                            if (meta.signature) {
                                if (!verifySignature({ userId, timestamp: meta.capturedAt, latitude, longitude }, meta.signature)) {
                                    return apiError('Tanda tangan data offline tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                                }
                            } else {
                                return apiError('Data offline harus ditandatangani', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                            }
                        }
                    }
                } catch (_e) {}
            }

            ctx.validated = { location, latitude, longitude, isOffline: !!offlineTime }
        }

        const attendanceService = new AttendanceService()
        const idempotencyService = new AttendanceIdempotencyService()

        resolvedRequestId = idempotencyService.resolveRequestId(request.headers.get('Idempotency-Key') ?? request.headers.get('idempotency-key'), bodyRequestId)

        let payloadHash: string | null = null
        if (resolvedRequestId) {
            payloadHash = idempotencyService.buildPayloadHash({ location, notes, latitude, longitude, photoUrl, offlineTime: offlineTime?.toISOString() ?? null })
            const beginState = await idempotencyService.begin(userId, 'check-out', resolvedRequestId, payloadHash)
            if (beginState === 'completed') {
                const replayPayload = await idempotencyService.getReplay<{ success: boolean; data: unknown; warning?: string }>(userId, 'check-out', resolvedRequestId)
                if (replayPayload) return apiSuccess(replayPayload, { headers: { 'X-Idempotent-Replay': 'true' } })
            }
            if (beginState === 'hash-mismatch') return apiError('Idempotency key sudah digunakan untuk payload berbeda', ErrorCodes.CONFLICT, { status: 409 })
            if (beginState === 'in-progress') return apiError('Permintaan check-out sedang diproses', ErrorCodes.CONFLICT, { status: 409 })
        }

        try {
            const result = await attendanceService.checkOut({ userId, photoUrl, location, notes, tenantId, latitude, longitude, offlineTime })
            if (resolvedRequestId && payloadHash) {
                await idempotencyService.complete(userId, 'check-out', resolvedRequestId, payloadHash, { success: true, data: result.attendance, ...(result.warning && { warning: result.warning }) })
            }
            return apiSuccess(result.attendance, result.warning ? { message: result.warning } : undefined)
        } catch (error: unknown) {
            if (error instanceof Error && error.message === 'OUTSIDE_GEOFENCE') return apiError('Anda berada di luar area absensi yang diizinkan', ErrorCodes.OUTSIDE_GEOFENCE, { status: 400 })
            if (error instanceof Error && error.message === 'NO_ACTIVE_SESSION') return apiError('Anda belum melakukan check-in atau sudah check-out hari ini', ErrorCodes.NO_ACTIVE_SESSION, { status: 400 })
            throw error
        }

    } catch (error: unknown) {
        if (userId && resolvedRequestId) {
            const idempotencyService = new AttendanceIdempotencyService()
            await idempotencyService.release(userId, 'check-out', resolvedRequestId)
        }
        throw error // Caught by createHandler
    }
})
