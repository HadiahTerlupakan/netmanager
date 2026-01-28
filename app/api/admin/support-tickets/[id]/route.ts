import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { TicketStatus, TicketPriority } from '@prisma/client'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { getAdminSupportTicketService } from '@/modules/pelanggan/services/AdminSupportTicketService'
import { z } from 'zod'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * Validation schema for updating ticket
 */
const updateTicketSchema = z.object({
    status: z.nativeEnum(TicketStatus).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    closingNote: z.string().max(1000).optional(),
})

/**
 * GET /api/admin/support-tickets/[id]
 * Get ticket detail with all replies
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const user = await verifyAuth(request)
    if (!user) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!await hasPermission('support:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat tiket')
    }

    const { id } = await params

    const hasSiteRestriction = await hasPermission('support:site_only')
    const service = getAdminSupportTicketService()

    const result = await service.getTicketById(id, {
        id: user.id,
        role: user.role,
        siteId: user.siteId,
    }, hasSiteRestriction)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Tiket')
        }
        if (result.code === 'FORBIDDEN') {
            return ApiErrors.forbidden(result.error!)
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data)
}

/**
 * PATCH /api/admin/support-tickets/[id]
 * Update ticket (status, priority, assignee)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const user = await verifyAuth(request)
    if (!user) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!await hasPermission('support:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah tiket')
    }

    const { id } = await params

    // Parse and validate body
    let body: any
    try {
        body = await request.json()
    } catch {
        return apiError('Invalid JSON body', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const parseResult = updateTicketSchema.safeParse(body)
    if (!parseResult.success) {
        return apiError(
            'Data tidak valid',
            ErrorCodes.VALIDATION_ERROR,
            { status: 400, details: parseResult.error.flatten().fieldErrors }
        )
    }

    const hasSiteRestriction = await hasPermission('support:site_only')
    const service = getAdminSupportTicketService()

    const result = await service.updateTicket(id, parseResult.data, {
        id: user.id,
        role: user.role,
        siteId: user.siteId,
    }, hasSiteRestriction)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Tiket')
        }
        if (result.code === 'FORBIDDEN') {
            return ApiErrors.forbidden(result.error!)
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data, { message: 'Tiket berhasil diupdate' })
}

/**
 * DELETE /api/admin/support-tickets/[id]
 * Delete ticket
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const user = await verifyAuth(request)
    if (!user) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!await hasPermission('support:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus tiket')
    }

    const { id } = await params

    const hasSiteRestriction = await hasPermission('support:site_only')
    const service = getAdminSupportTicketService()

    const result = await service.deleteTicket(id, {
        id: user.id,
        role: user.role,
        siteId: user.siteId,
    }, hasSiteRestriction)

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Tiket')
        }
        if (result.code === 'FORBIDDEN') {
            return ApiErrors.forbidden(result.error!)
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data, { message: 'Tiket berhasil dihapus' })
}
