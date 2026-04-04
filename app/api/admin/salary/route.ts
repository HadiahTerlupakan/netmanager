import { getSalaryService } from '@/modules/salary'
import { SalaryStatus, EmployeeType } from '@prisma/client'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'
import * as z from 'zod'

const service = getSalaryService()

const calculateSalarySchema = z.object({
    action: z.enum(['calculate-single', 'calculate-bulk']),
    userId: z.string().uuid().optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    departmentId: z.string().uuid().optional(),
    siteId: z.string().uuid().optional(),
    employeeType: z.nativeEnum(EmployeeType).optional(),
})

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    // Permission check
    if (!await hasPermission('salary:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data gaji')
    }

    const { searchParams } = req.nextUrl
    const sessionUser = ctx.session!.user

    const monthStr = searchParams.get('month')
    const yearStr = searchParams.get('year')
    const status = searchParams.get('status') as SalaryStatus | undefined
    const userId = searchParams.get('userId') || undefined
    const departmentId = searchParams.get('departmentId') || undefined
    const employeeType = searchParams.get('employeeType') || undefined
    
    // Site-level isolation logic
    let siteId = searchParams.get('siteId') || undefined
    const isSiteOnly = await hasPermission('salary:site_only')

    if (isSiteOnly && !sessionUser.isSuperAdmin) {
        // Jika user dibatasi site_only, mereka hanya boleh melihat site mereka sendiri
        if (siteId && siteId !== sessionUser.siteId) {
            return ApiErrors.forbidden('Anda hanya diperbolehkan melihat data gaji di site Anda sendiri')
        }
        siteId = sessionUser.siteId as string
    }

    const filters = {
        ...(monthStr ? { month: parseInt(monthStr) } : {}),
        ...(yearStr ? { year: parseInt(yearStr) } : {}),
        ...(status ? { status } : {}),
        ...(userId ? { userId } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(siteId ? { siteId } : {}),
        ...(employeeType ? { employeeType } : {})
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
})

export const POST = createHandler({ 
    auth: true, 
    schema: calculateSalarySchema 
}, async (req, ctx) => {
    // Permission check
    if (!await hasPermission('salary:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat gaji')
    }

    const { action, userId, month, year, departmentId, employeeType } = ctx.validated
    const sessionUser = ctx.session!.user
    const sessionUserId = sessionUser.id
    
    // Site-level isolation logic
    let siteId = ctx.validated.siteId || undefined
    const isSiteOnly = await hasPermission('salary:site_only')

    if (isSiteOnly && !sessionUser.isSuperAdmin) {
        if (siteId && siteId !== sessionUser.siteId) {
            return ApiErrors.forbidden('Anda hanya diperbolehkan mengolah data gaji di site Anda sendiri')
        }
        siteId = sessionUser.siteId as string
    }

    if (action === 'calculate-single' && userId) {
        // Calculate for single user
        const result = await service.calculateSingle(userId, month, year, sessionUserId)

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
            { 
                ...(departmentId ? { departmentId } : {}),
                ...(siteId ? { siteId } : {}),
                ...(employeeType ? { employeeType } : {})
            },
            sessionUserId
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
})
