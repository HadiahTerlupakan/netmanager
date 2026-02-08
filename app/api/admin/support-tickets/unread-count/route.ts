import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { TicketStatus } from '@prisma/client'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

/**
 * GET /api/admin/support-tickets/unread-count
 * Get count of tickets that need attention
 *
 * Logic:
 * - OPEN tickets (new, never replied by admin)
 * - IN_PROGRESS tickets where last reply is from customer (need admin response)
 */
export async function GET(request: NextRequest) {
    const user = await verifyAuth(request)
    if (!user) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    // Permission check
    const permissions = await getUserPermissions(user.id)
    if (!isSuperAdmin(user) && !permissions.includes('support:read')) {
        return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: support:read')
    }

    try {
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
    } catch (error) {
        console.error('[Admin Support Tickets Unread Count] Error:', error)
        return ApiErrors.internalError('Gagal mengambil jumlah tiket')
    }
}
