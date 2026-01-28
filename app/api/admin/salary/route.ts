import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSalaryService } from '@/modules/salary/services/SalaryService'
import { SalaryStatus, EmployeeType } from '@prisma/client'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

const service = getSalaryService()

/**
 * Validation schema for calculating salary
 */
const calculateSalarySchema = z.object({
    action: z.enum(['calculate-single', 'calculate-bulk']),
    userId: z.string().uuid().optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    departmentId: z.string().uuid().optional(),
    siteId: z.string().uuid().optional(),
    employeeType: z.nativeEnum(EmployeeType).optional(),
})

/**
 * GET /api/admin/salary - Get all salaries with filters
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('salary:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data gaji')
        }

        const { searchParams } = new URL(request.url)

        const filters = {
            month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
            year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
            status: searchParams.get('status') as SalaryStatus | undefined,
            userId: searchParams.get('userId') || undefined,
            departmentId: searchParams.get('departmentId') || undefined,
            siteId: searchParams.get('siteId') || undefined,
            employeeType: searchParams.get('employeeType') || undefined
        }

        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
        const limit = searchParams.get('take') ? parseInt(searchParams.get('take')!) : 50

        const result = await service.getSalaries(filters, page, limit)

        if (!result.success) {
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess({
            salaries: result.data?.salaries,
            total: result.data?.total,
            stats: result.data?.stats,
            page: result.data?.page,
            totalPages: result.data?.totalPages
        })
    } catch (error) {
        console.error('Error fetching salaries:', error)
        return ApiErrors.internalError('Gagal mengambil data gaji')
    }
}

/**
 * POST /api/admin/salary - Calculate salary (single or bulk)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('salary:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat gaji')
        }

        const body = await request.json()
        
        // Validate with Zod
        const parseResult = calculateSalarySchema.safeParse(body)
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { action, userId, month, year, departmentId, siteId, employeeType } = parseResult.data

        if (!session.user.id) {
            return ApiErrors.unauthorized('User ID tidak ditemukan')
        }

        if (action === 'calculate-single' && userId) {
            // Calculate for single user
            const result = await service.calculateSingle(userId, month, year, session.user.id)

            if (!result.success) {
                return apiError(result.error || 'Gagal menghitung gaji', ErrorCodes.BUSINESS_LOGIC_ERROR, { status: 400 })
            }

            return apiSuccess({
                salaryId: result.data?.salaryId
            }, { message: 'Gaji berhasil dihitung' })
        } else if (action === 'calculate-bulk') {
            // Bulk calculate for all users
            const result = await service.calculateBulk(
                month,
                year,
                { departmentId, siteId, employeeType },
                session.user.id
            )

            if (!result.success) {
                return apiError(result.error || 'Gagal menghitung gaji', ErrorCodes.BUSINESS_LOGIC_ERROR, { status: 400 })
            }

            return apiSuccess({
                calculated: result.data?.success,
                failed: result.data?.failed
            }, { message: `${result.data?.success} gaji berhasil dihitung, ${result.data?.failed?.length || 0} gagal` })
        } else {
            return apiError(
                'Action tidak valid. Gunakan "calculate-single" atau "calculate-bulk"',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400 }
            )
        }
    } catch (error) {
        console.error('Error calculating salary:', error)
        return ApiErrors.internalError('Gagal menghitung gaji')
    }
}
