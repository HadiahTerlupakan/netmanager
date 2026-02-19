import { getSalaryService } from '@/modules/salary/services/SalaryService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'
import { z } from 'zod'

const reviseSchema = z.object({
    reason: z.string().min(1, 'Alasan wajib diisi')
})

/**
 * POST /api/admin/salary/[id]/revise - Request salary revision
 */
export const POST = createHandler({
    auth: true,
    schema: reviseSchema
}, async (req, ctx) => {
    if (!await hasPermission('salary:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk merevisi gaji')
    }

    const { id } = ctx.params
    const { reason } = ctx.validated

    const service = getSalaryService()
    const result = await service.requestRevision(id, ctx.session!.user.id, reason)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Gaji')
        }
        return apiError(result.error || 'Permintaan revisi gagal', ErrorCodes.BUSINESS_LOGIC_ERROR, { status: 400 })
    }

    return apiSuccess(null, { message: 'Permintaan revisi berhasil dikirim' })
})
