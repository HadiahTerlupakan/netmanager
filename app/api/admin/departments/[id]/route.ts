import { hasPermission } from '@/lib/rbac'
import { getDepartmentService } from '@/modules/roles'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

const service = getDepartmentService()

/**
 * GET /api/admin/departments/[id] - Get department details
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('department:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat departemen')
    }

    const { id } = ctx.params
    const result = await service.getDepartmentById(id)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Departemen')
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data)
})

/**
 * PATCH /api/admin/departments/[id] - Update department
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('department:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah departemen')
    }

    const { id } = ctx.params
    const body = await req.json()

    const result = await service.updateDepartment(id, body, ctx.session!.user.id)

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
})

/**
 * DELETE /api/admin/departments/[id] - Delete department
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('department:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus departemen')
    }

    const { id } = ctx.params
    const result = await service.deleteDepartment(id, ctx.session!.user.id)

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
})
