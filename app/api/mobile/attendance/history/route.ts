import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'

export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const skip = (page - 1) * limit

        const [attendances, total] = await Promise.all([
            prisma.attendance.findMany({
                where: { userId },
                orderBy: { checkIn: 'desc' },
                take: limit,
                skip
            }),
            prisma.attendance.count({ where: { userId } })
        ])

        // Check Holiday for Today (User Filter? Timezone?)
        // Ideally we should use user's timezone, but for now server time or basic check is okay for display.
        // We will assume server time ~ user time for simplicity or refine later.
        const holidayRepo = new HolidayRepository()
        const { isHoliday, holiday } = await holidayRepo.isHoliday(new Date())

        // Check Off Day for Today (based on user's workDays)
        const userData = await prisma.user.findUnique({
            where: { id: userId },
            select: { workDays: true }
        })

        let isOffDay = false
        if (userData?.workDays) {
            const today = new Date()
            const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday
            const dayMap: Record<string, number> = { 
                'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
                'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6,
                '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
            }
            const workDays = userData.workDays.split(',').map(d => {
                const trimmed = d.trim()
                const parsed = parseInt(trimmed)
                if (!isNaN(parsed)) return parsed
                return dayMap[trimmed]
            }).filter(d => d !== undefined)
            // SAFEGUARD: Jika workDays kosong setelah parsing, jangan set isOffDay = true
            isOffDay = workDays.length > 0 && !workDays.includes(dayOfWeek)
        }

        return NextResponse.json({
            success: true,
            data: attendances,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            today: {
                isHoliday,
                holidayName: holiday?.description || null,
                isOffDay
            }
        })

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
