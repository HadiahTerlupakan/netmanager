import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { ShiftService } from '@/modules/shift'

const shiftService = new ShiftService()

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:read'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { id } = await params
        const shift = await shiftService.getShiftById(id)
        
        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
        }

        return NextResponse.json(shift)
    } catch (error: any) {
        console.error('[Shifts API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:update'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { id } = await params
        const body = await request.json()

        const shift = await shiftService.updateShift(id, {
            name: body.name,
            code: body.code,
            startTime: body.startTime,
            endTime: body.endTime,
            description: body.description,
            isActive: body.isActive
        })

        return NextResponse.json(shift)
    } catch (error: any) {
        console.error('[Shifts API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:delete'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const force = searchParams.get('force') === 'true'

        await shiftService.deleteShift(id, force)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[Shifts API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}
