import { OvertimeService } from '@/modules/overtime'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('lembur:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data lembur')
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const skip = (page - 1) * limit

        let siteId = searchParams.get('siteId') || undefined
        let departmentId = searchParams.get('departmentId') || undefined

        // NEW: Enforce RBAC Restrictions
        const user = session.user as any;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (user.permissions?.includes('lembur:site_only') && !isSuperAdmin) {
            siteId = user.siteId;
        }
        if (user.permissions?.includes('lembur:department_only') && !isSuperAdmin) {
            departmentId = user.departmentId;
        }
        const status = searchParams.get('status') || undefined
        const startDateStr = searchParams.get('startDate')
        const endDateStr = searchParams.get('endDate')

        const filters: any = { skip, take: limit, siteId, departmentId, status }

        if (startDateStr && endDateStr) {
            const start = new Date(startDateStr)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDateStr)
            end.setHours(23, 59, 59, 999)
            filters.startDate = start
            filters.endDate = end
        }

        const service = new OvertimeService()
        const result = await service.getAllRequests(filters)

        return apiSuccess({
            data: result.data,
            summary: result.summary,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit)
            }
        })
    } catch (error: any) {
        console.error('Error fetching lembur:', error)
        return ApiErrors.internalError('Gagal mengambil data lembur')
    }
}
