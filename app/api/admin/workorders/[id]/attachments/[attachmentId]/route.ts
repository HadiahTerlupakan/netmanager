import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'
import { getWorkOrderService, type UserContext } from '@/modules/work-order'
import { prisma } from '@/lib/prisma'

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id, attachmentId } = ctx.params;

    // Permission check (Update permission required to delete attachments)
    if (!await hasPermission('list:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus attachment')
    }

    if (!id || !attachmentId) {
        return apiError('ID Work Order dan Attachment ID wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Fetch user details for context
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { siteId: true, departmentId: true, role: true }
    });
    if (!dbUser) return ApiErrors.unauthorized();

    const userContext: UserContext = {
        id: user.id,
        role: user.role,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const workOrderService = getWorkOrderService()
    const result = await workOrderService.deleteAttachment(id, attachmentId, userContext)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound(result.error || 'Attachment tidak ditemukan')
        }
        return apiError(result.error || 'Gagal menghapus attachment', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    return apiSuccess(null, { message: 'Attachment berhasil dihapus' })
})
