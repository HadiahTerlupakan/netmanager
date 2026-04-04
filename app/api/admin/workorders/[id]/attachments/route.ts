import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'
import { getWorkOrderService, type UserContext } from '@/modules/work-order'
import { logActivitySafe } from '@/lib/logger'
import { prisma } from '@/modules/database'

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    // Permission check (Update permission required to add attachments)
    if (!await hasPermission('list:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menambah attachment')
    }

    const body = await req.json()
    const { fileName, filePath, fileType, caption, fileSize } = body

    if (!fileName || !filePath || !fileType) {
        return apiError('fileName, filePath, dan fileType wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
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

    // Use service to add attachment (handles timeline updates and socket events)
    const workOrderService = getWorkOrderService()
    const result = await workOrderService.addAttachment(id, {
        fileName,
        filePath,
        fileType,
        fileSize: fileSize || 0,
        caption
    }, userContext)

    if (!result.success) {
        return apiError(result.error || 'Gagal menambah attachment', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    const attachment = result.data

    // Log Activity
    logActivitySafe({
        action: 'UPDATE',
        subject: 'Work Order',
        userId: user.id,
        details: {
            workOrderId: id,
            type: 'ATTACHMENT_UPLOAD',
            fileName
        }
    })

    return apiSuccess(attachment, { message: 'Attachment berhasil ditambahkan' })
})
