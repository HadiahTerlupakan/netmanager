import { getSalaryService } from '@/modules/salary'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

/**
 * POST /api/admin/salary/[id]/audit - Audit salary
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    // Permission check
    if (!await hasPermission('salary:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk audit gaji')
    }

    const { id } = ctx.params
    const body = await req.json()
    const { notes } = body

    const service = getSalaryService()
    const result = await service.auditSalary(id, ctx.session!.user.id, notes)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Data gaji')
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data, { message: 'Gaji berhasil ditandai sebagai teraudit' })
})
