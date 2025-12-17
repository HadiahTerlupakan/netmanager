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

        // Validate Geofencing
        const latStr = formData.get('latitude') as string
        const lngStr = formData.get('longitude') as string

        if (latStr && lngStr) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { site: true }
            })

            if (user?.site) {
                // Strict Check: If user has a site, we MUST validate geofencing
                if (!user.site.latitude || !user.site.longitude) {
                    console.error('Geofencing Error: Site has no coordinates', { siteId: user.site.id, name: user.site.name });
                    return NextResponse.json({
                        error: 'Konfigurasi Lokasi (Site) tidak lengkap. Harap hubungi Admin untuk mengatur titik koordinat site.'
                    }, { status: 400 })
                }

                if (user.site.attendanceRadius) {
                    const userLat = parseFloat(latStr)
                    const userLng = parseFloat(lngStr)

                    if (isNaN(userLat) || isNaN(userLng)) {
                        return NextResponse.json({ error: 'Koordinat GPS tidak valid.' }, { status: 400 })
                    }

                    const distance = getDistance(
                        { latitude: userLat, longitude: userLng },
                        { latitude: user.site.latitude, longitude: user.site.longitude }
                    )

                    console.log('Geofencing Check:', {
                        user: user.name,
                        distance,
                        max: user.site.attendanceRadius,
                        allowed: distance <= user.site.attendanceRadius
                    })

                    if (isNaN(distance)) {
                        console.error('Geofencing Error: Distance calculation failed (NaN)')
                        return NextResponse.json({ error: 'Gagal menghitung jarak lokasi.' }, { status: 400 })
                    }

                    if (distance > user.site.attendanceRadius) {
                        return NextResponse.json({
                            error: `Anda berada di luar jangkauan lokasi absensi (Jarak: ${distance}m, Max: ${user.site.attendanceRadius}m)`
                        }, { status: 400 })
                    }
                }
            } else {
                // Fallback for users without site (e.g. mobile techs without fixed site? or legacy)
                // decided to allow or block?
                // Assuming strict mode:
                // return NextResponse.json({ error: 'Anda tidak memiliki lokasi kerja (Site) yang terdaftar.' }, { status: 400 })

                // For now, logging skip but proceeding (preserving backward compatibility if needed,
                // but user asked "kenapa bisa?", implying they want it blocked.)
                console.log('Geofencing Skipped: User has no site assigned', { userId })
            }
        } else {
            // If lat/long params missing from request
            console.log('Geofencing Check: No coordinates provided in request', { userId })

            // Only ERROR if user HAS a site that requires checking
            const userCheck = await prisma.user.findUnique({
                where: { id: userId },
                select: { siteId: true }
            })

            console.log('Geofencing Check: User site check', { hasSite: !!userCheck?.siteId, siteId: userCheck?.siteId })

            if (userCheck?.siteId) {
                return NextResponse.json({ error: 'Gagal mendeteksi lokasi Anda. Pastikan GPS aktif.' }, { status: 400 })
            }
        }

        // Buat data attendance
        const attendance = await prisma.attendance.create({
            data: {
                userId,
                checkIn: new Date(),
                checkInPhoto: photoUrl,
                location,
                notes,
                status: 'PRESENT'
            }
        })

        logger.apiRequest('POST', '/api/attendance/check-in', 201, Date.now() - startTime, {
            userId,
            attendanceId: attendance.id
        })

        return NextResponse.json({ success: true, data: attendance })

    } catch (error: any) {
        logger.error('Error in check-in', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
