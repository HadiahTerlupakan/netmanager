import { 
  apiSuccess, ApiErrors, createHandler
} from '@/lib/api'
import { supportTicketUpdateSchema } from '@/lib/validations/support-ticket'
import { idSchema } from '@/lib/validations/common'
import { getAdminSupportTicketService } from '@/modules/pelanggan/services/AdminSupportTicketService'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

/**
 * GET /api/admin/support-tickets/[id]
 * Get single support ticket with all replies
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const { id } = ctx.params

    if (!await hasPermission("support:read")) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    // Validate ID format
    const parseResult = idSchema.safeParse(id)
    if (!parseResult.success) {
        return ApiErrors.badRequest('ID tidak valid', { errors: parseResult.error.flatten().fieldErrors })
    }

    // Site restriction logic
    const permissions = await getUserPermissions(user.id);
    const isSuper = isSuperAdmin(user);
    const hasSiteRestriction = !isSuper && permissions.includes('support:site_only');
    
    let siteId: string | undefined
    if (hasSiteRestriction) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
        siteId = dbUser?.siteId || undefined
    }

    const service = getAdminSupportTicketService()

    const result = await service.getTicketById(parseResult.data, {
        id: user.id,
        ...(user.role !== undefined && { role: user.role }),
        ...(hasSiteRestriction && { siteId }),
    }, hasSiteRestriction)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Tiket')
        }
        if (result.code === 'FORBIDDEN') {
            return ApiErrors.forbidden(result.error || 'Akses ditolak')
        }
        throw new Error(result.error || 'Gagal mengambil detail tiket')
    }

    return apiSuccess(result.data)
})

/**
 * PATCH /api/admin/support-tickets/[id]
 * Update ticket (status, priority, assignee)
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const { id } = ctx.params

    if (!await hasPermission("support:update")) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    // Validate ID format
    const idParseResult = idSchema.safeParse(id)
    if (!idParseResult.success) {
        return ApiErrors.badRequest('ID tidak valid', { errors: idParseResult.error.flatten().fieldErrors })
    }

    // Parse and validate request body
    const body = await req.json()
    const parseResult = supportTicketUpdateSchema.safeParse(body)

    if (!parseResult.success) {
        return ApiErrors.badRequest('Data tidak valid', { errors: parseResult.error.flatten().fieldErrors })
    }

    // Site restriction logic
    const permissions = await getUserPermissions(user.id);
    const isSuper = isSuperAdmin(user);
    const hasSiteRestriction = !isSuper && permissions.includes('support:site_only');

    let siteId: string | undefined
    if (hasSiteRestriction) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
        siteId = dbUser?.siteId || undefined
    }

    const service = getAdminSupportTicketService()

    const updateData = {
        ...(parseResult.data.status !== undefined && { status: parseResult.data.status }),
        ...(parseResult.data.priority !== undefined && { priority: parseResult.data.priority }),
        ...(parseResult.data.assignedToId !== undefined && { assignedToId: parseResult.data.assignedToId }),
        ...(parseResult.data.resolution && { closingNote: parseResult.data.resolution }),
    }

    const result = await service.updateTicket(idParseResult.data, updateData, {
        id: user.id,
        ...(user.role !== undefined && { role: user.role }),
        ...(hasSiteRestriction && { siteId }),
    }, hasSiteRestriction)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Tiket')
        }
        if (result.code === 'FORBIDDEN') {
            return ApiErrors.forbidden(result.error || 'Akses ditolak')
        }
        throw new Error(result.error || 'Gagal mengupdate tiket')
    }

    return apiSuccess(result.data, { message: 'Tiket berhasil diupdate' })
})

/**
 * DELETE /api/admin/support-tickets/[id]
 * Delete support ticket
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const { id } = ctx.params

    if (!await hasPermission("support:delete")) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    // Validate ID format
    const parseResult = idSchema.safeParse(id)
    if (!parseResult.success) {
        return ApiErrors.badRequest('ID tidak valid', { errors: parseResult.error.flatten().fieldErrors })
    }

    // Site restriction logic
    const permissions = await getUserPermissions(user.id);
    const isSuper = isSuperAdmin(user);
    const hasSiteRestriction = !isSuper && permissions.includes('support:site_only');

    let siteId: string | undefined
    if (hasSiteRestriction) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
        siteId = dbUser?.siteId || undefined
    }

    const service = getAdminSupportTicketService()

    const result = await service.deleteTicket(parseResult.data, {
        id: user.id,
        ...(user.role !== undefined && { role: user.role }),
        ...(hasSiteRestriction && { siteId }),
    }, hasSiteRestriction)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Tiket')
        }
        if (result.code === 'FORBIDDEN') {
            return ApiErrors.forbidden(result.error || 'Akses ditolak')
        }
        throw new Error(result.error || 'Gagal menghapus tiket')
    }

    return apiSuccess(result.data, { message: 'Tiket berhasil dihapus' })
})
