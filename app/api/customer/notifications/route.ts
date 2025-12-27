import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customer-auth'

/**
 * GET /api/customer/notifications
 * Get customer notifications including ticket replies
 */
export async function GET(request: NextRequest) {
    const auth = await requireCustomerAuth(request)
    if (auth.response) return auth.response

    const { session } = auth
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    try {
        // Get tickets with unread admin replies
        const ticketsWithNewReplies = await prisma.supportTickets.findMany({
            where: {
                pelangganId: session.id,
            },
            select: {
                id: true,
                ticketNumber: true,
                subject: true,
                status: true,
                replies: {
                    where: {
                        isFromAdmin: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        message: true,
                        createdAt: true,
                        user: {
                            select: { name: true },
                        },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
            take: limit,
        })

        // Transform to notification format
        const notifications = ticketsWithNewReplies
            .filter(ticket => ticket.replies.length > 0)
            .map(ticket => ({
                id: `ticket-reply-${ticket.replies[0].id}`,
                type: 'TICKET_REPLY',
                title: 'Balasan Tiket',
                message: `Tiket #${ticket.ticketNumber.split('-').pop()} telah dibalas`,
                preview: ticket.replies[0].message.substring(0, 100) + (ticket.replies[0].message.length > 100 ? '...' : ''),
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                ticketSubject: ticket.subject,
                createdAt: ticket.replies[0].createdAt,
                isRead: ticket.status === 'CLOSED' || ticket.status === 'RESOLVED',
                sender: ticket.replies[0].user?.name || 'Tim Dukungan',
            }))

        return NextResponse.json({
            success: true,
            notifications,
        })
    } catch (error) {
        console.error('[Customer Notifications GET] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengambil notifikasi' },
            { status: 500 }
        )
    }
}
