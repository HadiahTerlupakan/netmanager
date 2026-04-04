import { isSuperAdmin, getUserPermissions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getLeaveService } from '@/modules/attendance'
import { prisma } from '@/modules/database'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import * as z from 'zod'

const service = getLeaveService()

const updateLeaveStatusSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: z.string().max(500).optional(),
})

export const PATCH = createHandler({ 
    auth: true, 
    schema: updateLeaveStatusSchema 
}, async (req, ctx) => {
    // Permission check - using VERIFY for status updates (Approval/Rejection)
    if (!await hasPermission('izin:verify')) {
        return ApiErrors.forbidden('Anda membutuhkan permission verify')
    }

    const { id } = ctx.params
    const { status, rejectionReason } = ctx.validated
    const user = ctx.session!.user
    const tenantId = user.tenantId

    // Ownership Check - fetch existing leave
    const existing = await prisma.leaveRequest.findUnique({
        where: { id, tenantId },
        include: { user: true }
    })

    if (!existing) {
        return ApiErrors.notFound('Pengajuan izin')
    }

    // Access Control
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
        const { prisma: db } = await import('@/modules/database');
        const dbUser = await db.user.findUnique({ where: { id: user.id, tenantId }, select: { siteId: true, departmentId: true } });
        
        if (permissions.includes('izin:site_only') && dbUser?.siteId) {
            if (existing.user.siteId !== dbUser.siteId) {
                return ApiErrors.forbidden('Dibatasi hanya untuk Site Anda')
            }
        }
        if (permissions.includes('izin:department_only') && dbUser?.departmentId) {
            if (existing.user.departmentId !== dbUser.departmentId) {
                return ApiErrors.forbidden('Dibatasi hanya untuk Departemen Anda')
            }
        }
    }

    // Call service based on status
    const result = status === 'APPROVED'
        ? await service.approveLeave(id, user.id, tenantId)
        : await service.rejectLeave(id, user.id, tenantId, rejectionReason || '')

    if (!result.success) {
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data, {
        message: status === 'APPROVED' ? 'Izin berhasil disetujui' : 'Izin berhasil ditolak'
    })
})

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    // Permission check
    if (!await hasPermission('izin:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus izin')
    }

    const { id } = ctx.params
    const user = ctx.session!.user
    const tenantId = user.tenantId

    // Ownership Check
    const existing = await prisma.leaveRequest.findUnique({
        where: { id, tenantId },
        include: { user: true }
    })

    if (!existing) {
        return ApiErrors.notFound('Pengajuan izin')
    }

    // Access Control
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
        const { prisma: db } = await import('@/modules/database');
        const dbUser = await db.user.findUnique({ where: { id: user.id, tenantId }, select: { siteId: true, departmentId: true } });

        if (permissions.includes('izin:site_only') && dbUser?.siteId) {
            if (existing.user.siteId !== dbUser.siteId) {
                return ApiErrors.forbidden('Dibatasi hanya untuk Site Anda')
            }
        }
        if (permissions.includes('izin:department_only') && dbUser?.departmentId) {
            if (existing.user.departmentId !== dbUser.departmentId) {
                return ApiErrors.forbidden('Dibatasi hanya untuk Departemen Anda')
            }
        }
    }

    const result = await service.deleteLeave(id, user.id, tenantId)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Pengajuan izin')
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(null, { message: 'Izin berhasil dihapus' })
})
