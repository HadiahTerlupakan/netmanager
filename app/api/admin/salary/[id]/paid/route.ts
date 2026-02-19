import { getSalaryService } from '@/modules/salary/services/SalaryService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

/**
 * POST /api/admin/salary/[id]/paid - Mark salary as paid
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    // Permission check
    if (!await hasPermission('salary:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah status gaji')
    }

    const { id } = ctx.params
    const body = await req.json().catch(() => ({}));
    const { notes } = body

    const service = getSalaryService()
    const result = await service.markAsPaid(id, ctx.session!.user.id, notes)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Data gaji')
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data, { message: 'Gaji berhasil ditandai sebagai dibayar' })
})
