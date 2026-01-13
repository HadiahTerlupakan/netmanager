import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDistance } from 'geolib'
import { randomUUID } from 'crypto'
import { GeofenceService } from '@/modules/attendance/services/GeofenceService'
import { AttendanceValidationService } from '@/modules/attendance/services/AttendanceValidationService'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id as string

        // Parse basic data needed for image upload (logic kept in controller for now)
        const formData: any = await request.formData()
        const photo = formData.get('photo') as File | null
        const location = formData.get('location') as string
        const notes = formData.get('notes') as string

        let photoUrl = null

        if (photo) {
            // Validasi foto
            if (!photo.type.startsWith('image/')) {
                return NextResponse.json({ error: 'File harus berupa gambar' }, { status: 400 })
            }

            const MAX_SIZE = 5 * 1024 * 1024 // 5MB
            if (photo.size > MAX_SIZE) {
                return NextResponse.json({ error: 'Ukuran foto maksimal 5MB' }, { status: 400 })
            }

            // Upload foto
            const dateStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD
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

        // --- Use Centralized Service ---
        const attendanceService = new AttendanceService()
        
        // Parse coordinates
        const latStr = formData.get('latitude') as string
        const lngStr = formData.get('longitude') as string
        let latitude: number | undefined
        let longitude: number | undefined
        
        if (latStr && lngStr) {
            latitude = parseFloat(latStr)
            longitude = parseFloat(lngStr)
        }

        const attendance = await attendanceService.checkIn({
            userId,
            photoUrl,
            location,
            notes,
            latitude,
            longitude,
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

    } catch (error: any) {
        logger.error('Error in check-in', error)
        
        // Handle Custom Service Errors
        if (error.message === 'DUPLICATE_ENTRY') {
            return NextResponse.json({ error: 'Anda sudah melakukan check-in hari ini' }, { status: 400 })
        }
        if (error.message.startsWith('CHECKIN_REJECTED:')) {
            const reason = error.message.split(':')[1]
            return NextResponse.json({ 
                error: `Check-in ditolak: ${reason}`,
                code: 'VALIDATION_ERROR' 
            }, { status: 400 })
        }
        
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
