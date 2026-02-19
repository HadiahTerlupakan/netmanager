import { isSuperAdmin, getUserPermissions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getLeaveService } from '@/modules/attendance/services/LeaveService'
import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { z } from 'zod'

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

    // Ownership Check - fetch existing leave
    const existing = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { user: true }
    })

    if (!existing) {
        return ApiErrors.notFound('Pengajuan izin')
    }

    // Access Control
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, departmentId: true } });
        
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
    let result
    if (status === 'APPROVED') {
        result = await service.approveLeave(id, user.id)
    } else {
        result = await service.rejectLeave(id, user.id, rejectionReason || '')
    }

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

    // Ownership Check
    const existing = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { user: true }
    })

    if (!existing) {
        return ApiErrors.notFound('Pengajuan izin')
    }

    // Access Control
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, departmentId: true } });

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

    const result = await service.deleteLeave(id, user.id)

    if (!result.success) {
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(null, { message: 'Izin berhasil dihapus' })
})
