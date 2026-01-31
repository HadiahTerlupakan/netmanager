import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { ShiftService } from '@/modules/shift'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

const shiftService = new ShiftService()

export async function GET(request: NextRequest) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:read'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat shift')
    }

    try {
        const { searchParams } = new URL(request.url)
        const includeInactive = searchParams.get('includeInactive') === 'true'

        const shifts = await shiftService.getAllShifts(includeInactive)
        return apiSuccess(shifts)
    } catch (error) {
        console.error('[Shifts API] Error:', error)
        return ApiErrors.internalError('Gagal mengambil data shift')
    }
}

export async function POST(request: NextRequest) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:create'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat shift')
    }

    try {
        const body = await request.json()

        // Validate required fields
        if (!body.name || !body.startTime || !body.endTime) {
            return apiError('name, startTime, dan endTime wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const shift = await shiftService.createShift({
            name: body.name,
            code: body.code || null,
            startTime: body.startTime,
            endTime: body.endTime,
            description: body.description || null
        })

        return apiSuccess(shift, { status: 201, message: 'Shift berhasil dibuat' })
    } catch (error) {
        console.error('[Shifts API] Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal membuat shift'
        return apiError(errorMessage, ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }
}
