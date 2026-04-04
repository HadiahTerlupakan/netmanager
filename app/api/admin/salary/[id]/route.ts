import { getSalaryService } from '@/modules/salary'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

const service = getSalaryService()

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('salary:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data gaji')
    }

    const { id } = ctx.params
    const result = await service.getSalaryById(id)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Data gaji')
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess({ salary: result.data })
})

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('salary:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah gaji')
    }

    const { id } = ctx.params
    const body = await req.json()

    const result = await service.updateSalary(id, { auditNotes: body.auditNotes }, ctx.session!.user.id)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Data gaji')
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess({ salary: result.data }, { message: 'Gaji berhasil diperbarui' })
})

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('salary:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus gaji')
    }

    const { id } = ctx.params
    const result = await service.deleteSalary(id, ctx.session!.user.id)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Data gaji')
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(null, { message: 'Gaji berhasil dihapus' })
})
