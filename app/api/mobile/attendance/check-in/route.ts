import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, logActivitySafe } from '@/lib/logger'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { AttendancePhotoService } from '@/modules/attendance/services/AttendancePhotoService'
import { verifySignature } from '@/lib/crypto'

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')

        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        if (!token) {
            return NextResponse.json({ error: 'Token tidak tersedia' }, { status: 401 })
        }
        const decoded = await verifyMobileToken(token)

        if (!decoded) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const userId = decoded.userId as string

        // Fetch Settings first to determine Timezone
        const [toleranceSetting, timezoneSetting] = await Promise.all([
            prisma.settings.findFirst({
                where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' }
            }),
            prisma.settings.findFirst({
                where: { key: 'GENERAL_TIMEZONE' }
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
                                      return NextResponse.json({
                                          error: 'Tanda tangan data offline tidak valid',
                                          code: 'VALIDATION_ERROR'
                                      }, { status: 400 })
                                  }
                             } else {
                                 return NextResponse.json({
                                     error: 'Data offline harus ditandatangani',
                                     code: 'VALIDATION_ERROR'
                                 }, { status: 400 })
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
                    return NextResponse.json({
                        error: error instanceof Error ? error.message : 'Unknown photo processing error',
                        code: 'VALIDATION_ERROR'
                    }, { status: 400 })
                }
            }
        } else if (contentType.includes('application/json')) {
            const body = await request.json() as {
              location: string;
              notes: string;
              latitude?: number;
              longitude?: number;
              photoUrl?: string;
              capturedAt?: string;
              _offline_meta?: { capturedAt?: string; signature?: string }
            }
            location = body.location
            notes = body.notes

            // Validate coordinates using centralized utility
            if (body.latitude !== undefined && body.longitude !== undefined) {
                const { validateCoordinates } = await import('@/lib/validation-utils')
                const coordValidation = validateCoordinates(body.latitude, body.longitude)

                if (!coordValidation.valid) {
                    return NextResponse.json({
                        error: coordValidation.error,
                        code: coordValidation.code
                    }, { status: 400 })
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
                    const trustedDomains = [
                        'cdn.radpro.id',
                        'localhost:3000',
                        '0.0.0.0:3000',
                        // Add other trusted domains as needed
                    ]

                    try {
                        const url = new URL(body.photoUrl)
                        const isTrusted = trustedDomains.some(domain =>
                            url.host === domain || url.host.endsWith('.' + domain)
                        )

                        if (isTrusted) {
                            // PhotoUrl from our CDN is trusted (already uploaded via /api/mobile/upload)
                            photoUrl = body.photoUrl
                        } else {
                            // External URL not trusted - log warning but don't expose URL in log
                            logger.warn(`[SECURITY] Untrusted photoUrl rejected for user ${userId}`)
                            return NextResponse.json({
                                error: 'Photo URL tidak valid. Upload foto melalui endpoint yang benar.',
                                code: 'UNTRUSTED_PHOTO_URL'
                            }, { status: 400 })
                        }
                    } catch {
                        // Invalid URL format
                        return NextResponse.json({
                            error: 'Format Photo URL tidak valid',
                            code: 'INVALID_PHOTO_URL'
                        }, { status: 400 })
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
                        return NextResponse.json({
                            error: 'Data offline harus ditandatangani',
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
                             error: 'Tanda tangan data offline tidak valid',
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
        const checkInParams: {
          userId: string;
          photoUrl: string | null;
          location: string;
          notes: string;
          timezone: string;
          latitude?: number;
          longitude?: number;
          offlineTime?: Date;
        } = {
            userId,
            photoUrl,
            location,
            notes,
            timezone // Use fetched user timezone preference
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

        return NextResponse.json({ success: true, data: attendance })

    } catch (error: unknown) {
        if (error instanceof Error) {
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
        }

        logger.error('Error in mobile check-in', error as Error)
        return NextResponse.json({
            error: 'Terjadi kesalahan server',
            code: 'INTERNAL_ERROR'
        }, { status: 500 })
    }
}
