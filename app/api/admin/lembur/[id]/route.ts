import { NextRequest } from 'next/server'
import { OvertimeService } from '@/modules/overtime'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

/**
 * Validation schema for overtime action
 */
const overtimeActionSchema = z.object({
    action: z.enum(['approve', 'reject']).optional(),
    reason: z.string().max(500).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
})

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const { id } = await params
        const body = await request.json()
        
        const parseResult = overtimeActionSchema.safeParse(body)
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }
        
        const { action, reason, ...updateData } = parseResult.data

        // Check ownership & site/dept restrictions first
        const existing = await import('@/lib/prisma').then(m => m.prisma.overtime.findUnique({
            where: { id },
            include: { user: true }
        }))

        if (!existing) {
            return ApiErrors.notFound('Data lembur')
        }

        const user = session.user as any;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        if (!isSuperAdmin) {
             if (user.permissions?.includes('lembur:site_only') && existing.user.siteId !== user.siteId) {
                 return ApiErrors.forbidden('Dibatasi hanya untuk Site Anda')
             }
             if (user.permissions?.includes('lembur:department_only') && existing.user.departmentId !== user.departmentId) {
                  return ApiErrors.forbidden('Dibatasi hanya untuk Departemen Anda')
             }
        }

        const service = new OvertimeService()

        // Distinguish between APPROVE/REJECT (Verify) vs EDIT (Update)
        if (action === 'approve' || action === 'reject') {
            // VERIFICATION ACTIONS
            if (!await hasPermission('lembur:verify')) {
                return ApiErrors.forbidden('Anda membutuhkan permission verify')
            }

            if (action === 'approve') {
                const result = await service.approveRequest(id, session.user.id || 'system')
                
                // System Log
                try {
                const { logger } = await import('@/lib/logger')
                await logger.logActivity({
                    action: 'UPDATE',
                    subject: 'Overtime',
                    userId: session.user.id,
                    details: { id, action: 'APPROVE' }
                })
                } catch (e) { console.error('Logging failed', e) }

                return apiSuccess(result, { message: 'Lembur berhasil disetujui' })
            } else {
                if (!reason) {
                    return apiError('Alasan penolakan wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
                }
                const result = await service.rejectRequest(id, reason)

                // System Log
                try {
                const { logger } = await import('@/lib/logger')
                await logger.logActivity({
                    action: 'UPDATE',
                    subject: 'Overtime',
                    userId: session.user.id,
                    details: { id, action: 'REJECT', reason }
                })
                } catch (e) { console.error('Logging failed', e) }

                return apiSuccess(result, { message: 'Lembur berhasil ditolak' })
            }
        } else {
            // EDIT DATA ACTIONS (reason, startTime, endTime, etc.)
            if (!await hasPermission('lembur:update')) {
                return ApiErrors.forbidden('Anda membutuhkan permission update')
            }

            const prisma = await import('@/lib/prisma').then(m => m.prisma)
            
            // Clean up update data
            const cleanData: any = {}
            if (reason) cleanData.reason = reason
            if (updateData.startTime) cleanData.startTime = new Date(updateData.startTime)
            if (updateData.endTime) cleanData.endTime = new Date(updateData.endTime)
            
            const result = await prisma.overtime.update({
                where: { id },
                data: cleanData
            })

            // System Log
            try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Overtime',
                userId: session.user.id,
                details: { id, updates: cleanData }
            })
            } catch (e) { console.error('Logging failed', e) }

            return apiSuccess(result, { message: 'Data lembur berhasil diperbarui' })
        }

    } catch (error: any) {
        console.error('Error updating overtime:', error)
        return ApiErrors.internalError('Gagal memperbarui lembur')
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const { id } = await params

        // Permission check
        if (!await hasPermission('lembur:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus lembur')
        }

        // Ownership Check
        const existing = await import('@/lib/prisma').then(m => m.prisma.overtime.findUnique({
            where: { id },
            include: { user: true }
        }))

        if (existing) {
            const user = session.user as any;
            const isSuperAdmin = user.role === 'SUPER_ADMIN';
            if (!isSuperAdmin) {
                    if (user.permissions?.includes('lembur:site_only') && existing.user.siteId !== user.siteId) {
                        return ApiErrors.forbidden('Dibatasi hanya untuk Site Anda')
                    }
                    if (user.permissions?.includes('lembur:department_only') && existing.user.departmentId !== user.departmentId) {
                        return ApiErrors.forbidden('Dibatasi hanya untuk Departemen Anda')
                    }
            }
        }

        const service = new OvertimeService()
        await service.deleteOvertime(id)

        // System Log
        try {
        const { logger } = await import('@/lib/logger')
        await logger.logActivity({
            action: 'DELETE',
            subject: 'Overtime',
            userId: session.user.id,
            details: { id }
        })
        } catch (e) { console.error('Logging failed', e) }

        return apiSuccess(null, { message: 'Lembur berhasil dihapus' })
    } catch (error: any) {
        console.error('Error deleting overtime:', error)
        return ApiErrors.internalError('Gagal menghapus lembur')
    }
}
