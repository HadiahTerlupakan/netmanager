import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AttendancePhotoService } from '@/modules/attendance/services/AttendancePhotoService'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        if (!userId) {
            return NextResponse.json({
                error: 'Unauthorized',
                code: 'UNAUTHORIZED'
            }, { status: 401 })
        }

        // Cari attendance aktif (sudah check-in, belum check-out)
        // Kita mundur 24 jam untuk mengakomodasi perbedaan timezone atau edit jam manual
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
            }
        })

        if (!attendance) {
            return NextResponse.json({
                error: 'Anda belum melakukan check-in atau sudah check-out hari ini',
                code: 'NO_ACTIVE_SESSION'
            }, { status: 400 })
        }

        const formData: any = await request.formData()
        const photo = formData.get('photo') as File | null
        const notes = formData.get('notes') as string // Optional checkout notes
        const location = formData.get('location') as string // Fetch location from form data

        // Process photo using centralized service
        const photoService = new AttendancePhotoService()
        let photoUrl: string | null = null
        
        if (photo) {
            try {
                photoUrl = await photoService.processPhoto(photo, userId, 'checkout')
            } catch (error: any) {
                return NextResponse.json({
                    error: error.message,
                    code: 'VALIDATION_ERROR'
                }, { status: 400 })
            }
        }

        // Update attendance
        const updatedAttendance = await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
                checkOut: new Date(),
                checkOutPhoto: photoUrl,
                checkOutLocation: location || undefined,
                notes: notes ? (attendance.notes ? `${attendance.notes}; Checkout Note: ${notes}` : notes) : undefined
            }
        })

        logger.apiRequest('POST', '/api/attendance/check-out', 200, Date.now() - startTime, {
            userId,
            attendanceId: updatedAttendance.id
        })

        return NextResponse.json({ success: true, data: updatedAttendance })

    } catch (error: any) {
        logger.error('Error in check-out', error)
        return NextResponse.json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        }, { status: 500 })
    }
}
