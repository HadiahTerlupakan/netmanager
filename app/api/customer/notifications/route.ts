import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/database'
import { Prisma, TicketStatus } from '@prisma/client'
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
    const now = new Date()

    try {
        const unreadTicketWhere: Prisma.SupportTicketsWhereInput = {
            pelangganId: session.id,
            status: {
                in: [TicketStatus.WAITING_CUSTOMER, TicketStatus.IN_PROGRESS],
            },
            replies: {
                some: {
                    isFromAdmin: true,
                },
            },
        }

        const unreadTicketCount = await prisma.supportTickets.count({
            where: unreadTicketWhere,
        })

        const ticketsWithNewReplies = await prisma.supportTickets.findMany({
            where: {
                ...unreadTicketWhere,
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

        const unreadAnnouncementWhere: Prisma.AnnouncementWhereInput = {
            isActive: true,
            target: {
                in: ['ALL', 'CUSTOMER'],
            },
            AND: [
                {
                    OR: [
                        { startDate: null },
                        { startDate: { lte: now } },
                    ],
                },
                {
                    OR: [
                        { endDate: null },
                        { endDate: { gte: now } },
                    ],
                },
                {
                    reads: {
                        none: {
                            pelangganId: session.id,
                        },
                    },
                },
            ],
        }

        const [unreadAnnouncementCount, announcements] = await Promise.all([
            prisma.announcement.count({ where: unreadAnnouncementWhere }),
            prisma.announcement.findMany({
                where: unreadAnnouncementWhere,
                select: {
                    id: true,
                    title: true,
                    content: true,
                    isPinned: true,
                    createdAt: true,
                },
                orderBy: [
                    { isPinned: 'desc' },
                    { createdAt: 'desc' },
                ],
                take: 3,
            }),
        ])

        // Transform to notification format
        const notifications = ticketsWithNewReplies
            .filter(ticket => ticket.replies.length > 0)
            .map(ticket => {
                const reply = ticket.replies[0]!
                return {
                    id: `ticket-reply-${reply.id}`,
                    type: 'TICKET_REPLY',
                    title: 'Balasan Tiket',
                    message: `Tiket #${ticket.ticketNumber.split('-').pop()} telah dibalas`,
                    preview: reply.message.substring(0, 100) + (reply.message.length > 100 ? '...' : ''),
                    ticketId: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    ticketSubject: ticket.subject,
                    createdAt: reply.createdAt,
                    isRead: false,
                    sender: reply.user?.name || 'Tim Dukungan',
                }
            })

        return NextResponse.json({
            success: true,
            notifications,
            announcements,
            unreadTicketCount,
            unreadAnnouncementCount,
            unreadCount: unreadTicketCount + unreadAnnouncementCount,
        })
    } catch (error) {
        console.error('[Customer Notifications GET] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengambil notifikasi' },
            { status: 500 }
        )
    }
}
