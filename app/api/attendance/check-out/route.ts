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
            return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
        }

        const userId = session.user.id
        if (!userId) {
            return NextResponse.json({
                error: 'Unauthorized',
                code: 'UNAUTHORIZED'
            }, { status: 401 })
        }

        const formData: any = await request.formData()
        const photo = formData.get('photo') as File | null
        const notes = formData.get('notes') as string
        const location = formData.get('location') as string

        // Process photo using centralized service
        let photoUrl: string | null = null
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

        // Use centralized service
        const attendanceService = new AttendanceService()
        try {
            const result = await attendanceService.checkOut({
                userId,
                photoUrl,
                location,
                notes
            })

            logger.apiRequest('POST', '/api/attendance/check-out', 200, Date.now() - startTime, {
                userId,
                attendanceId: result.attendance.id
            })

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
        logger.error('Error in check-out', error)
        return NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        }, { status: 500 })
    }
}

