import { getSalaryService } from '@/modules/salary'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

/**
 * POST /api/admin/salary/[id]/recalculate - Recalculate salary
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    // Permission check
    if (!await hasPermission('salary:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghitung ulang gaji')
    }

    const { id } = ctx.params
    const service = getSalaryService()
    const result = await service.recalculateSalary(id, ctx.session!.user.id)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Data gaji')
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess({
        salaryId: result.data?.salaryId
    }, { message: 'Gaji berhasil dihitung ulang' })
})
