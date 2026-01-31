import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getLeaveService } from '@/modules/attendance/services/LeaveService'
import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

const service = getLeaveService()

/**
 * Validation schema for updating leave status
 */
const updateLeaveStatusSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: z.string().max(500).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check - using VERIFY for status updates (Approval/Rejection)
        if (!await hasPermission('izin:verify')) {
            return ApiErrors.forbidden('Anda membutuhkan permission verify')
        }

        const body = await request.json()
        const parseResult = updateLeaveStatusSchema.safeParse(body)
        
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { status, rejectionReason } = parseResult.data

        // Ownership Check - fetch existing leave
        const existing = await prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!existing) {
            return ApiErrors.notFound('Pengajuan izin')
        }

        // Access Control
        const user = session.user as {
            role?: string;
            permissions?: string[];
            siteId?: string;
            departmentId?: string;
        }
        const isSuperAdmin = user.role === 'SUPER_ADMIN'
        if (!isSuperAdmin) {
            if (user.permissions?.includes('izin:site_only') && existing.user.siteId !== user.siteId) {
                return ApiErrors.forbidden('Dibatasi hanya untuk Site Anda')
            }
            if (user.permissions?.includes('izin:department_only') && existing.user.departmentId !== user.departmentId) {
                return ApiErrors.forbidden('Dibatasi hanya untuk Departemen Anda')
            }
        }

        // Call service based on status
        let result
        if (status === 'APPROVED') {
            result = await service.approveLeave(id, session.user.id)
        } else {
            result = await service.rejectLeave(id, session.user.id, rejectionReason || '')
        }

        if (!result.success) {
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(result.data, {
            message: status === 'APPROVED' ? 'Izin berhasil disetujui' : 'Izin berhasil ditolak'
        })
    } catch (error: unknown) {
        console.error('Error updating leave:', error)
        return ApiErrors.internalError('Gagal memperbarui status izin')
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('izin:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus izin')
        }

        // Ownership Check
        const existing = await prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!existing) {
            return ApiErrors.notFound('Pengajuan izin')
        }

        // Access Control
        const user = session.user as {
            role?: string;
            permissions?: string[];
            siteId?: string;
            departmentId?: string;
        }
        const isSuperAdmin = user.role === 'SUPER_ADMIN'
        if (!isSuperAdmin) {
            if (user.permissions?.includes('izin:site_only') && existing.user.siteId !== user.siteId) {
                return ApiErrors.forbidden('Dibatasi hanya untuk Site Anda')
            }
            if (user.permissions?.includes('izin:department_only') && existing.user.departmentId !== user.departmentId) {
                return ApiErrors.forbidden('Dibatasi hanya untuk Departemen Anda')
            }
        }

        const result = await service.deleteLeave(id, session.user.id)

        if (!result.success) {
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(null, { message: 'Izin berhasil dihapus' })
    } catch (error: unknown) {
        console.error('Error deleting leave:', error)
        return ApiErrors.internalError('Gagal menghapus izin')
    }
}
