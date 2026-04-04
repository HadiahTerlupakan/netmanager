import { getSalaryService } from '@/modules/salary/services/SalaryService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import * as z from 'zod'

const adjustSchema = z.object({
    name: z.string().min(1, 'Nama komponen wajib diisi'),
    type: z.enum(['EARNING', 'DEDUCTION']),
    amount: z.number().min(0, 'Jumlah harus lebih besar dari 0'),
    notes: z.string().min(1, 'Catatan / Alasan wajib diisi')
})

/**
 * POST /api/admin/salary/[id]/adjust - Add manual adjustment
 */
export const POST = createHandler({ 
    auth: true, 
    schema: adjustSchema 
}, async (req, ctx) => {
    if (!await hasPermission('salary:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah gaji')
    }

    const { id } = ctx.params
    const service = getSalaryService()
    const result = await service.addAdjustment(id, ctx.validated, ctx.session!.user.id)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Data gaji')
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(null, { message: 'Penyesuaian berhasil ditambahkan' })
})
