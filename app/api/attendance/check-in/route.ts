import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDistance } from 'geolib'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id as string

        // Fetch User and Settings first to determine Timezone
        const [userDetails, toleranceSetting, timezoneSetting] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    startWorkTime: true,
                    endWorkTime: true,
                    workingHourMode: true
                }
            }),
            prisma.settings.findFirst({
                where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' }
            }),
            prisma.settings.findFirst({
                where: { key: 'GENERAL_TIMEZONE' }
            })
        ])

        const timezone = timezoneSetting?.value || 'Asia/Jakarta'
        const toleranceMinutes = toleranceSetting?.value ? parseInt(toleranceSetting.value) : 0

        // Timezone Logic:
        // 1. Get current "Wall Clock" time in the target timezone
        const now = new Date()
        const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }))

        // 2. Calculate offset (WallClock - RealUTC) to shift queries back to UTC if needed
        // Note: This offset includes the day difference if any.
        const tzOffsetMs = nowInTz.getTime() - now.getTime()

        // 3. Define "Today" (Start of Day) in the Target Timezone
        // We use nowInTz to get the correct Year/Month/Day
        const startOfDayInTz = new Date(nowInTz)
        startOfDayInTz.setHours(0, 0, 0, 0)

        // 4. effectiveToday is the UTC timestamp representing 00:00 of the target timezone
        const effectiveToday = new Date(startOfDayInTz.getTime() - tzOffsetMs)


        // 1. Auto-Checkout logic for stale sessions (yesterday or older)
        const staleSessions = await prisma.attendance.findMany({
            where: {
                userId,
                checkOut: null,
                checkIn: {
                    lt: effectiveToday
                }
            }
        })

        if (staleSessions.length > 0) {
            await Promise.all(staleSessions.map(async (session) => {
                let autoCheckOut = new Date(session.checkIn)

                if (userDetails?.workingHourMode === 'FLEXIBLE') {
                    // Flexible: CheckIn + 9 hours (standard working hours)
                    autoCheckOut.setHours(autoCheckOut.getHours() + 9)
                } else {
                    // Fixed: Use endWorkTime or default 17:00
                    if (userDetails?.endWorkTime) {
                        const [endHour, endMinute] = userDetails.endWorkTime.split(':').map(Number)
                        autoCheckOut.setHours(endHour, endMinute, 0, 0)
                    } else {
                        autoCheckOut.setHours(17, 0, 0, 0)
                    }
                }

                // Safety check: If calculated checkout is before checkin (e.g. bad config), force it to be after
                if (autoCheckOut <= session.checkIn) {
                    autoCheckOut = new Date(session.checkIn.getTime() + 9 * 60 * 60 * 1000)
                }

                // If checkIn was very late (e.g. 20:00) and fixed end is 17:00, it would be in the past.
                // In that case, we probably should set it to 23:59 of that day to close the loop?
                // Or just trust the calculation? 
                // Let's stick to the user's initial rule: "23:59 jika masuknya malam" (implied by "checkIn > autoCheckOut")
                if (session.checkIn > autoCheckOut) {
                    autoCheckOut.setHours(23, 59, 59, 999)
                }

                const autoNote = '(Auto-Checkout: Lupa Absen Pulang)'
                const newNotes = session.notes ? `${session.notes} ${autoNote}` : autoNote

                await prisma.attendance.update({
                    where: { id: session.id },
                    data: {
                        checkOut: autoCheckOut,
                        notes: newNotes
                    }
                })
            }))
        }

        // 2. Check for today's check-in
        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: {
                    gte: effectiveToday
                }
            }
        })

        if (existingAttendance) {
            return NextResponse.json({ error: 'Anda sudah melakukan check-in hari ini' }, { status: 400 })
        }

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

        let status = 'ON_TIME'

        // Logika Status: Jika punya jadwal masuk, cek keterlambatan
        if (userDetails?.startWorkTime) {
            const [schedHour, schedMinute] = userDetails.startWorkTime.split(':').map(Number)

            // Buat objek Date untuk jadwal hari ini (menggunakan konteks Timezone)
            const scheduleTime = new Date(startOfDayInTz)
            scheduleTime.setHours(schedHour, schedMinute, 0, 0)

            // Tambahkan batas toleransi
            const toleranceMs = toleranceMinutes * 60 * 1000
            const lateThreshold = new Date(scheduleTime.getTime() + toleranceMs)

            // Bandingkan Wall Clock Time user (nowInTz) dengan Jadwal (scheduleTime)
            // nowInTz dan scheduleTime keduanya ada dalam "Timezone Context" (UTC-shifted values)
            if (nowInTz > lateThreshold) {
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
                id: randomUUID(),
                updatedAt: new Date(),
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
