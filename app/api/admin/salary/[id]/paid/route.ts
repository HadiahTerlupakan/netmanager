import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSalaryService } from '@/modules/salary/services/SalaryService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/admin/salary/[id]/paid - Mark salary as paid
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('salary:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah status gaji')
        }

        const { id } = await params
        const body = await request.json().catch(() => ({}))
        const { notes } = body

        const service = getSalaryService()
        const result = await service.markAsPaid(id, session.user.id, notes)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Data gaji')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(result.data, { message: 'Gaji berhasil ditandai sebagai dibayar' })
    } catch (error) {
        console.error('Error marking salary as paid:', error)
        return ApiErrors.internalError('Gagal menandai gaji sebagai dibayar')
    }
}
