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
            return NextResponse.json({ error: 'Anda belum melakukan check-in atau sudah check-out hari ini' }, { status: 400 })
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
            latitude = body.latitude
            longitude = body.longitude
        } else {
            const formData: any = await request.formData()
            const photo = formData.get('photo') as File
            notes = formData.get('notes') as string
            location = formData.get('location') as string
            
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
                const fileName = `${userId}_checkout_${Date.now()}`
    
                photoUrl = await convertAndSaveImage(
                    photo,
                    uploadDir,
                    fileName,
                    'employee-attendance',
                    userId
                )
            }

            // Parse latitude/longitude from formData
            const latStr = formData.get('latitude') as string
            const lngStr = formData.get('longitude') as string
            if (latStr && lngStr) {
                latitude = parseFloat(latStr)
                longitude = parseFloat(lngStr)
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
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
