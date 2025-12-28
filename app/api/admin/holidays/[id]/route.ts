import { NextRequest, NextResponse } from 'next/server'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'

const holidayRepo = new HolidayRepository()

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!await hasPermission('holidays:delete')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { id } = await params
        await holidayRepo.delete(id)
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!await hasPermission('holidays:update')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { id } = await params
        const body = await request.json()
        const { date, description, isNational } = body

        const updateData: any = {}
        if (date) updateData.date = new Date(date)
        if (description) updateData.description = description
        if (isNational !== undefined) updateData.isNational = isNational

        const holiday = await holidayRepo.update(id, updateData)
        return NextResponse.json({ success: true, data: holiday })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update holiday' }, { status: 500 })
    }
}
