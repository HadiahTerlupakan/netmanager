import { isSuperAdmin, getUserPermissions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getLeaveService } from '@/modules/attendance/services/LeaveService'
import { LeaveType, LeaveStatus } from '@prisma/client'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'
import * as z from 'zod'

const service = getLeaveService()

const createLeaveSchema = z.object({
    userId: z.string().uuid('Invalid user ID'),
    type: z.nativeEnum(LeaveType),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
    reason: z.string().min(1, 'Alasan wajib diisi').max(500),
    attachmentUrl: z.string().url().optional().nullable(),
})

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const tenantId = user.tenantId

    // Permission check
    if (!await hasPermission('izin:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data izin/cuti')
    }

    const { searchParams } = req.nextUrl
    const status = searchParams.get('status')
    let siteId = searchParams.get('siteId') || undefined
    let departmentId = searchParams.get('departmentId') || undefined

    // Enforce RBAC Restrictions
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
        if (permissions.includes('izin:site_only')) {
             const { prisma: db } = await import('@/lib/prisma');
             const dbUser = await db.user.findUnique({ where: { id: user.id, tenantId }, select: { siteId: true } });
             siteId = dbUser?.siteId || undefined
        }
        if (permissions.includes('izin:department_only')) {
             const { prisma: db } = await import('@/lib/prisma');
             const dbUser = await db.user.findUnique({ where: { id: user.id, tenantId }, select: { departmentId: true } });
             departmentId = dbUser?.departmentId || undefined
        }
    }

    const result = await service.getLeaves({
        ...(status ? { status: status as LeaveStatus } : {}),
        ...(siteId ? { siteId } : {}),
        ...(departmentId ? { departmentId } : {}),
        tenantId
    })

    if (!result.success) {
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data?.leaves || [])
})

export const POST = createHandler({ 
    auth: true,
    schema: createLeaveSchema
}, async (req, ctx) => {
    // Permission check
    if (!await hasPermission('izin:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat izin/cuti')
    }

    const { userId, type, startDate, endDate, reason, attachmentUrl } = ctx.validated
    const user = ctx.session!.user
    const tenantId = user.tenantId

    const result = await service.createLeave(
        {
            userId,
            type,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            ...(attachmentUrl ? { attachmentUrl } : {})
        },
        user.id,
        tenantId,
        true // Auto-approve for manual admin entry
    )

    if (!result.success) {
        return apiError(result.error || 'Gagal membuat izin/cuti', ErrorCodes.BUSINESS_LOGIC_ERROR, { status: 400 })
    }

    return apiSuccess(result.data, { status: 201, message: 'Izin/cuti berhasil dibuat' })
})
