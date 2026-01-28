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
 * POST /api/admin/salary/[id]/recalculate - Recalculate salary
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('salary:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghitung ulang gaji')
        }

        const { id } = await params

        const service = getSalaryService()
        const result = await service.recalculateSalary(id, session.user.id)

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Data gaji')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess({
            salaryId: result.data?.salaryId
        }, { message: 'Gaji berhasil dihitung ulang' })
    } catch (error) {
        console.error('Error recalculating salary:', error)
        return ApiErrors.internalError('Gagal menghitung ulang gaji')
    }
}
