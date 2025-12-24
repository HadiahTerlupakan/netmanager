import { NextRequest, NextResponse } from 'next/server'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
import { requireAdmin } from '@/lib/auth-helpers'

const holidayRepo = new HolidayRepository()

export async function GET(request: NextRequest) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

    try {
        const holidays = await holidayRepo.getHolidaysByYear(year)
        return NextResponse.json({ success: true, data: holidays })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    try {
        const body = await request.json()
        const { date, description, isNational } = body

        if (!date || !description) {
            return NextResponse.json({ error: 'Date and description are required' }, { status: 400 })
        }

        const holiday = await holidayRepo.create({
            date: new Date(date),
            description,
            isNational: isNational ?? true
        })

        return NextResponse.json({ success: true, data: holiday })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Holiday for this date already exists' }, { status: 409 })
        }
        console.error('Create holiday error:', error)
        return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 })
    }
}
