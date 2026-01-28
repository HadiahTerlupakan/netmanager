import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getDepartmentService } from '@/modules/roles/services/DepartmentService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const service = getDepartmentService()

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/admin/departments/[id] - Get department details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('department:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat departemen')
        }

        const { id } = await params
        const result = await service.getDepartmentById(id)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Departemen')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(result.data)
    } catch (error) {
        console.error('Error fetching department:', error)
        return ApiErrors.internalError('Gagal mengambil data departemen')
    }
}

/**
 * PATCH /api/admin/departments/[id] - Update department
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('department:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah departemen')
        }

        const { id } = await params
        const body = await request.json()

        const result = await service.updateDepartment(id, body, user.id)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Departemen')
            }
            if (result.code === 'DUPLICATE_NAME') {
                return ApiErrors.conflict('Nama departemen sudah digunakan')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(result.data, { message: 'Departemen berhasil diperbarui' })
    } catch (error) {
        console.error('Error updating department:', error)
        return ApiErrors.internalError('Gagal memperbarui departemen')
    }
}

/**
 * DELETE /api/admin/departments/[id] - Delete department
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('department:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus departemen')
        }

        const { id } = await params
        const result = await service.deleteDepartment(id, user.id)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Departemen')
            }
            if (result.code === 'HAS_USERS' || result.code === 'HAS_WORKORDERS') {
                return ApiErrors.conflict('Departemen masih memiliki karyawan atau work order aktif')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(null, { message: 'Departemen berhasil dihapus' })
    } catch (error) {
        console.error('Error deleting department:', error)
        return ApiErrors.internalError('Gagal menghapus departemen')
    }
}
