import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { TicketStatus } from '@prisma/client'

/**
 * GET /api/customer/notifications/unread-count
 * Get count of unread notifications for customer
 */
export async function GET(request: NextRequest) {
    const auth = await requireCustomerAuth(request)
    if (auth.response) return auth.response

    const { session } = auth

    try {
        // Count tickets with admin replies that are still active (not closed/resolved)
        // These are considered "unread" notifications
        const ticketsNeedingAttention = await prisma.supportTickets.findMany({
            where: {
                pelangganId: session.id,
                status: {
                    in: [TicketStatus.WAITING_CUSTOMER, TicketStatus.IN_PROGRESS],
                },
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

        // Count tickets where last reply is from admin (awaiting customer response)
        const unreadCount = ticketsNeedingAttention.filter(
            ticket => ticket.replies[0]?.isFromAdmin
        ).length

        return NextResponse.json({
            success: true,
            count: unreadCount,
        })
    } catch (error) {
        console.error('[Customer Notifications Unread Count] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengambil jumlah notifikasi' },
            { status: 500 }
        )
    }
}
