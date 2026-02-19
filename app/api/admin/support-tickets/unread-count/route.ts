import { prisma } from '@/lib/prisma'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { TicketStatus } from '@prisma/client'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

/**
 * GET /api/admin/support-tickets/unread-count
 * Get count of tickets that need attention
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user

    // Permission check
    const permissions = await getUserPermissions(user.id)
    if (!isSuperAdmin(user) && !permissions.includes('support:read')) {
        return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: support:read')
    }

    // 1. Count OPEN tickets (brand new, need first response)
    const openTickets = await prisma.supportTickets.count({
        where: {
            status: 'OPEN'
        }
    })

    const inProgressTickets = await prisma.supportTickets.findMany({
        where: {
            status: TicketStatus.IN_PROGRESS,
        },
        select: {
            id: true,
            replies: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { isFromAdmin: true },
            },
        },
    })

    // Count tickets where last reply is from customer (not admin)
    const needsReplyCount = inProgressTickets.filter(
        (ticket) => ticket.replies.length > 0 && !ticket.replies[0]?.isFromAdmin
    ).length

    // Also include WAITING_CUSTOMER tickets if customer has replied
    const waitingCustomerTickets = await prisma.supportTickets.findMany({
        where: {
            status: TicketStatus.WAITING_CUSTOMER,
        },
        select: {
            id: true,
            replies: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { isFromAdmin: true },
            },
        },
    })

    const customerRepliedWhileWaiting = waitingCustomerTickets.filter(
        (ticket) => ticket.replies.length > 0 && !ticket.replies[0]?.isFromAdmin
    ).length

    const totalNeedsAttention = openTickets + needsReplyCount + customerRepliedWhileWaiting

    return apiSuccess({
        count: totalNeedsAttention,
        breakdown: {
            openTickets,
            needsReply: needsReplyCount,
            customerRepliedWhileWaiting,
        },
    })
})
