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
 * POST /api/admin/salary/[id]/approve - Approve salary
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('salary:approve')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menyetujui gaji')
        }

        const { id } = await params
        const body = await request.json()
        const { notes } = body

        const service = getSalaryService()
        const result = await service.approveSalary(id, session.user.id, notes)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Data gaji')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(result.data, { message: 'Gaji berhasil disetujui' })
    } catch (error) {
        console.error('Error approving salary:', error)
        return ApiErrors.internalError('Gagal menyetujui gaji')
    }
}
