import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
import { createHandler } from '@/lib/api'
import { NextResponse } from 'next/server'

/**
 * GET /api/mobile/holidays
 * Get holidays by year for mobile calendar view (read-only)
 */
export const GET = createHandler({ auth: true }, async (_request, ctx) => {
    try {
        const tenantId = ctx.session!.user.tenantId as string
        const yearParam = ctx.query.year as string
        const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

        const holidayRepo = new HolidayRepository()
        const holidays = await holidayRepo.getHolidaysByYear(year, tenantId)

        return NextResponse.json({
            success: true,
            data: holidays.map(h => ({
                id: h.id,
                name: h.description, // description is the holiday name
                date: h.date,
                isNational: h.isNational // true = Libur Nasional, false = Cuti Bersama
            }))
        })
    } catch (error) {
        console.error('Get holidays error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengambil data hari libur' },
            { status: 500 }
        )
    }
})

