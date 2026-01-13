import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { ShiftService } from '@/modules/shift'

const shiftService = new ShiftService()

export async function GET(request: NextRequest) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:read'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const includeInactive = searchParams.get('includeInactive') === 'true'
        
        const shifts = await shiftService.getAllShifts(includeInactive)
        return NextResponse.json(shifts)
    } catch (error: any) {
        console.error('[Shifts API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:create'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await request.json()
        
        // Validate required fields
        if (!body.name || !body.startTime || !body.endTime) {
            return NextResponse.json(
                { error: 'name, startTime, and endTime are required' },
                { status: 400 }
            )
        }

        const shift = await shiftService.createShift({
            name: body.name,
            code: body.code || null,
            startTime: body.startTime,
            endTime: body.endTime,
            description: body.description || null
        })

        return NextResponse.json(shift, { status: 201 })
    } catch (error: any) {
        console.error('[Shifts API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}
