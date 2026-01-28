import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSalaryService } from '@/modules/salary/services/SalaryService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

const reviseSchema = z.object({
    reason: z.string().min(1, 'Alasan wajib diisi')
})

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/admin/salary/[id]/revise - Request salary revision
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk merevisi gaji')
        }

        const { id } = await params
        const body = await request.json()

        // Validate input
        const parsed = reviseSchema.safeParse(body)
        if (!parsed.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parsed.error.flatten().fieldErrors }
            )
        }

        const service = getSalaryService()
        const result = await service.requestRevision(id, session.user.id, parsed.data.reason)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Gaji')
            }
            return apiError(result.error || 'Permintaan revisi gagal', ErrorCodes.BUSINESS_LOGIC_ERROR, { status: 400 })
        }

        return apiSuccess(null, { message: 'Permintaan revisi berhasil dikirim' })
    } catch (error) {
        console.error('Error requesting revision:', error)
        return ApiErrors.internalError('Gagal meminta revisi gaji')
    }
}
