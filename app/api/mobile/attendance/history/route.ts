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
                holidayName: holiday?.description || null
            }
        })

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
