import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDistance } from 'geolib'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id as string

        // Cek apakah sudah check-in hari ini
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Convert UTC Date to local date consideration might be needed depending on server time logic
        // Using prisma dates usually stores as UTC. Better to check between range of today 00:00 to 23:59 based on timezone if important.
        // For simplicity assuming server time or UTC overlap is handled or basic "start of day" logic suffices for now.
        // Ideally we should use user's timezone, but for now standard Start of Day Check.

        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: {
                    gte: today
                }
            }
        })

        if (existingAttendance) {
            return NextResponse.json({ error: 'Anda sudah melakukan check-in hari ini' }, { status: 400 })
        }

        const formData = await request.formData()
        const photo = formData.get('photo') as File
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


        // Ambil data user details untuk cek jam kerja
        const userDetails = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                startWorkTime: true,
                workingHourMode: true
            }
        })

        let status = 'ON_TIME'

        // Logika Status: Jika punya jadwal masuk, cek keterlambatan
        if (userDetails?.startWorkTime) {
            const [schedHour, schedMinute] = userDetails.startWorkTime.split(':').map(Number)

            // Buat objek Date untuk jadwal hari ini
            const scheduleTime = new Date()
            scheduleTime.setHours(schedHour, schedMinute, 0, 0)

            // Toleransi (optional, misalnya 5 menit? Untuk sekarang strict dulu atau ikut plan)
            // Di plan tidak ada toleransi, jadi strict > schedule = LATE

            const now = new Date()

            if (now > scheduleTime) {
                status = 'LATE'
            }
        }

        // Log lokasi untuk audit (tetap dipertahankan)
        const latStr = formData.get('latitude') as string
        const lngStr = formData.get('longitude') as string
        if (latStr && lngStr) {
            console.log('Attendance Check-In Location:', { userId, lat: latStr, lng: lngStr, status })
        }

        // Buat data attendance
        const attendance = await prisma.attendance.create({
            data: {
                userId,
                checkIn: new Date(),
                checkInPhoto: photoUrl,
                location,
                notes,
                status: status
            }
        })

        logger.apiRequest('POST', '/api/attendance/check-in', 201, Date.now() - startTime, {
            userId,
            attendanceId: attendance.id,
            status
        })

        return NextResponse.json({ success: true, data: attendance })

    } catch (error: any) {
        logger.error('Error in check-in', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
