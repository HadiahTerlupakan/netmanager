import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getDepartmentService } from '@/modules/roles/services/DepartmentService'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

const service = getDepartmentService()

/**
 * GET /api/admin/departments - List all departments
 * Refactored to use DepartmentService (thin controller pattern)
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('department:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat departemen')
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined
        const reminderOnly = searchParams.get('reminderOnly') === 'true'

        const result = await service.getDepartments({ search, reminderOnly })

        if (!result.success) {
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(result.data)
    } catch (error) {
        console.error('Error fetching departments:', error)
        return ApiErrors.internalError('Gagal mengambil data departemen')
    }
}

/**
 * POST /api/admin/departments - Create new department
 * Refactored to use DepartmentService (thin controller pattern)
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('department:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat departemen')
        }

        const body = await request.json()

        const result = await service.createDepartment(body, user.id)

        if (!result.success) {
            if (result.code === 'VALIDATION_ERROR') {
                return apiError(result.error || 'Data tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
            }
            if (result.code === 'DUPLICATE_NAME') {
                return ApiErrors.conflict('Nama departemen sudah ada')
            }
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(result.data, { status: 201, message: 'Departemen berhasil dibuat' })
    } catch (error) {
        console.error('Error creating department:', error)
        return ApiErrors.internalError('Gagal membuat departemen')
    }
}
