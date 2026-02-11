import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/mobile/holidays
 * Get holidays by year for mobile calendar view (read-only)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const yearParam = searchParams.get('year')
        const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

        const holidayRepo = new HolidayRepository()
        const holidays = await holidayRepo.getHolidaysByYear(year)

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
}

