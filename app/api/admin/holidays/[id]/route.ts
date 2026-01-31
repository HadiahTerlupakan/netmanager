import { NextRequest, NextResponse } from 'next/server'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const holidayRepo = new HolidayRepository()

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (session.user.role !== 'ADMIN' && !await hasPermission('holiday:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus hari libur')
    }

    try {
        const { id } = await params
        await holidayRepo.delete(id)
        return apiSuccess(null, { message: 'Hari libur berhasil dihapus' })
    } catch (error: unknown) {
        console.error('Delete holiday error:', error)
        return ApiErrors.internalError('Gagal menghapus hari libur')
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    if (session.user.role !== 'ADMIN' && !await hasPermission('holiday:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah hari libur')
    }

    try {
        const { id } = await params
        const body = await request.json()
        const { date, description, isNational } = body

        const updateData: {
            date?: Date;
            description?: string;
            isNational?: boolean;
        } = {}
        if (date) updateData.date = new Date(date)
        if (description) updateData.description = description
        if (isNational !== undefined) updateData.isNational = isNational

        const holiday = await holidayRepo.update(id, updateData)
        return apiSuccess(holiday, { message: 'Hari libur berhasil diperbarui' })
    } catch (error: unknown) {
        console.error('Update holiday error:', error)
        return ApiErrors.internalError('Gagal memperbarui hari libur')
    }
}
