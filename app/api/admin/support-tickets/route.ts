import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { TicketStatus, TicketCategory, TicketPriority } from '@prisma/client'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { getAdminSupportTicketService } from '@/modules/pelanggan/services/AdminSupportTicketService'

/**
 * GET /api/admin/support-tickets
 * Get all support tickets with filters
 */
export async function GET(request: NextRequest) {
    const user = await verifyAuth(request)
    if (!user) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    // Permission check
    if (!await hasPermission('support:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat tiket')
    }

    const { searchParams } = new URL(request.url)

    const filters = {
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '20'),
        status: searchParams.get('status') as TicketStatus | undefined,
        category: searchParams.get('category') as TicketCategory | undefined,
        priority: searchParams.get('priority') as TicketPriority | undefined,
        search: searchParams.get('search') || undefined,
        assignedToMe: searchParams.get('assignedToMe') === 'true',
    }

    const hasSiteRestriction = await hasPermission('support:site_only')
    const service = getAdminSupportTicketService()

    const result = await service.getTickets(filters, {
        id: user.id,
        role: user.role,
        siteId: user.siteId,
    }, hasSiteRestriction)

    if (!result.success) {
        if (result.code === 'FORBIDDEN') {
            return ApiErrors.forbidden(result.error!)
        }
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data)
}
