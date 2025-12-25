import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

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
            return NextResponse.json({ error: 'Anda belum melakukan check-in atau sudah check-out hari ini' }, { status: 400 })
        }

        const formData: any = await request.formData()
        const photo = formData.get('photo') as File
        const notes = formData.get('notes') as string // Optional checkout notes
        const location = formData.get('location') as string // Fetch location from form data

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
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
