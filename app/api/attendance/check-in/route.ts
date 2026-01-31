import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { AttendancePhotoService } from '@/modules/attendance/services/AttendancePhotoService'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id as string

        // Parse form data
        const formData = await request.formData()
        const photo = formData.get('photo') as File | null
        const location = formData.get('location') as string
        const notes = formData.get('notes') as string

        // Process photo using centralized service
        const photoService = new AttendancePhotoService()
        let photoUrl: string | null = null
        
        try {
            photoUrl = await photoService.processPhoto(photo, userId, 'checkin')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return NextResponse.json({
                error: errorMessage,
                code: 'VALIDATION_ERROR'
            }, { status: 400 })
        }

        // Use centralized attendance service
        const attendanceService = new AttendanceService()
        
        // Parse coordinates
        const latStr = formData.get('latitude') as string
        const lngStr = formData.get('longitude') as string
        let latitude: number | undefined
        let longitude: number | undefined
        
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

        const attendance = await attendanceService.checkIn({
            userId,
            photoUrl,
            location,
            notes,
            ...(latitude !== undefined ? { latitude } : {}),
            ...(longitude !== undefined ? { longitude } : {}),
            // Web always uses server time and configured timezone, but we can pass explicit TZ if needed
            // AttendanceService fetches User&Settings internally, so we don't strictly need to pass TZ here
            // unless we want to override it. Service defaults to 'Asia/Jakarta' or fetches from DB setting.
        })
        
        logger.apiRequest('POST', '/api/attendance/check-in', 201, Date.now() - startTime, {
            userId,
            attendanceId: attendance.id,
            status: attendance.status
        })

        return NextResponse.json({ success: true, data: attendance })

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error))
        logger.error('Error in check-in', err)

        const errorMessage = error instanceof Error ? error.message : 'Internal server error';

        // Handle Custom Service Errors
        if (errorMessage === 'DUPLICATE_ENTRY') {
            return NextResponse.json({
                error: 'Anda sudah melakukan check-in hari ini',
                code: 'DUPLICATE_ENTRY'
            }, { status: 400 })
        }
        if (errorMessage.startsWith('CHECKIN_REJECTED:')) {
            const reason = errorMessage.split(':')[1]
            return NextResponse.json({
                error: `Check-in ditolak: ${reason}`,
                code: 'VALIDATION_ERROR',
                details: { reason }
            }, { status: 400 })
        }
        
        return NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        }, { status: 500 })
    }
}
