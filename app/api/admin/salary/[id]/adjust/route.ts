import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSalaryService } from '@/modules/salary/services/SalaryService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

const adjustSchema = z.object({
    name: z.string().min(1, 'Nama komponen wajib diisi'),
    type: z.enum(['EARNING', 'DEDUCTION']),
    amount: z.number().min(0, 'Jumlah harus lebih besar dari 0'),
    notes: z.string().min(1, 'Catatan / Alasan wajib diisi')
})

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/admin/salary/[id]/adjust - Add manual adjustment
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

        // Validate input
        const parsed = adjustSchema.safeParse(body)
        if (!parsed.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parsed.error.flatten().fieldErrors }
            )
        }

        const service = getSalaryService()
        const result = await service.addAdjustment(id, parsed.data, session.user.id)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Data gaji')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(null, { message: 'Penyesuaian berhasil ditambahkan' })
    } catch (error) {
        console.error('Error adding adjustment:', error)
        return ApiErrors.internalError('Gagal menambahkan penyesuaian')
    }
}
