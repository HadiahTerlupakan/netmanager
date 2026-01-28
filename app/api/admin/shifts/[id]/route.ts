import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { ShiftService } from '@/modules/shift'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

const shiftService = new ShiftService()

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:read'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat shift')
    }

    try {
        const { id } = await params
        const shift = await shiftService.getShiftById(id)
        
        if (!shift) {
            return ApiErrors.notFound('Shift')
        }

        return apiSuccess(shift)
    } catch (error: any) {
        console.error('[Shifts API] Error:', error)
        return ApiErrors.internalError('Gagal mengambil data shift')
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:update'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengupdate shift')
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

        return apiSuccess(shift, { message: 'Shift berhasil diperbarui' })
    } catch (error: any) {
        console.error('[Shifts API] Error:', error)
        return apiError(error.message || 'Gagal memperbarui shift', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (!(await hasPermission('shift:delete'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus shift')
    }

    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const force = searchParams.get('force') === 'true'

        await shiftService.deleteShift(id, force)

        return apiSuccess(null, { message: 'Shift berhasil dihapus' })
    } catch (error: any) {
        console.error('[Shifts API] Error:', error)
        return apiError(error.message || 'Gagal menghapus shift', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }
}
