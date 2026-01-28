import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSalaryService } from '@/modules/salary/services/SalaryService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

interface RouteParams {
    params: Promise<{ id: string }>
}

const service = getSalaryService()

/**
 * GET /api/admin/salary/[id] - Get salary detail
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data gaji')
        }

        const { id } = await params
        const result = await service.getSalaryById(id)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Data gaji')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess({ salary: result.data })
    } catch (error) {
        console.error('Error fetching salary:', error)
        return ApiErrors.internalError('Gagal mengambil data gaji')
    }
}

/**
 * PUT /api/admin/salary/[id] - Update salary detail (for revision)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah gaji')
        }

        const { id } = await params
        const body = await request.json()

        const result = await service.updateSalary(id, { auditNotes: body.auditNotes }, session.user.id)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Data gaji')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess({ salary: result.data }, { message: 'Gaji berhasil diperbarui' })
    } catch (error) {
        console.error('Error updating salary:', error)
        return ApiErrors.internalError('Gagal memperbarui gaji')
    }
}

/**
 * DELETE /api/admin/salary/[id] - Delete salary record
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus gaji')
        }

        const { id } = await params
        const result = await service.deleteSalary(id, session.user.id)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Data gaji')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(null, { message: 'Gaji berhasil dihapus' })
    } catch (error) {
        console.error('Error deleting salary:', error)
        return ApiErrors.internalError('Gagal menghapus gaji')
    }
}
