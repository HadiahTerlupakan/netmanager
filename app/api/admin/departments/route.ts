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

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined
        const reminderOnly = searchParams.get('reminderOnly') === 'true'
        // Allow simplified list for dropdowns (reminderOnly usually means active list)
        // or if just for selection purposes.
        // Let's assume if it's for selection, we might use a query param like 'activeOnly' or just rely on reminderOnly?
        // The previous code used 'reminderOnly'.
        // Let's also support 'forSelect' or just check if user is authenticated.

        // Revised Permission Check:
        // If query param 'reminderOnly' is true, allow any authenticated user (for dropdowns)
        // Otherwise require department:read
        if (!reminderOnly && !(await hasPermission('department:read'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat departemen (Butuh: department:read)')
        }

        const result = await service.getDepartments({ 
            ...(search ? { search } : {}),
            reminderOnly 
        })

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
