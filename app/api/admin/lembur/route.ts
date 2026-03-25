import { NextResponse } from 'next/server'
import { OvertimeService } from '@/modules/overtime'
import { lemburFilterSchema } from '@/lib/validations/lembur'
import { OvertimeStatus } from '@prisma/client'
import { createHandler, ApiErrors } from '@/lib/api'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'


/**
 * GET /api/admin/lembur
 * List overtime requests with pagination and filters
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user

    // 1. Permission Check
    if (!(await hasPermission("lembur:read"))) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    // 2. Validate Query Params
    const { searchParams } = req.nextUrl
    const queryParams = Object.fromEntries(searchParams.entries())
    
    const parseResult = lemburFilterSchema.safeParse(queryParams)
    if (!parseResult.success) {
        return ApiErrors.badRequest('Parameter tidak valid', { errors: parseResult.error.flatten().fieldErrors })
    }

    const { page, limit, startDate: startDateStr, endDate: endDateStr, status, holidayType } = parseResult.data
    const skip = (page - 1) * limit

    // 3. Apply RBAC Restrictions
    const permissions = await getUserPermissions(user.id);
    const isSuper = isSuperAdmin(user);
    
    // Build filters for service
    const serviceFilters: {
        skip: number;
        take: number;
        status?: OvertimeStatus;
        holidayType?: string;
        siteId?: string;
        departmentId?: string;
        startDate?: Date;
        endDate?: Date;
    } = {
        skip,
        take: limit,
        status: status as OvertimeStatus | undefined,
        holidayType
    }

    // Explicit filters from query params
    if (parseResult.data.siteId) serviceFilters.siteId = parseResult.data.siteId
    if (parseResult.data.departmentId) serviceFilters.departmentId = parseResult.data.departmentId

    if (!isSuper) {
        if (permissions.includes('lembur:site_only')) {
             const { prisma: db } = await import('@/lib/prisma');
             const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, departmentId: true } });
             if (dbUser?.siteId) serviceFilters.siteId = dbUser.siteId
        }
        if (permissions.includes('lembur:department_only')) {
             // If not already fetched
             const { prisma: db } = await import('@/lib/prisma');
             const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { departmentId: true } });
             if (dbUser?.departmentId) serviceFilters.departmentId = dbUser.departmentId
        }
    }

    // Apply date range filter
    if (startDateStr && endDateStr) {
        const start = new Date(startDateStr)
        start.setTime(toStartOfDay(start).getTime())
        const end = new Date(endDateStr)
        end.setTime(toEndOfDay(end).getTime())
        serviceFilters.startDate = start
        serviceFilters.endDate = end
    }

    const service = new OvertimeService()
    const result = await service.getAllRequests(serviceFilters)

    return NextResponse.json({
        success: true,
        data: result.data,
        summary: result.summary,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
        }
    })
})
