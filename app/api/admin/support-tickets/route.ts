import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { TicketStatus, TicketCategory, TicketPriority } from '@prisma/client'

/**
 * GET /api/admin/support-tickets
 * Get all support tickets with filters
 */
export async function GET(request: NextRequest) {
    const user = await verifyAuth(request)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const assignedToMe = searchParams.get('assignedToMe') === 'true'

    const skip = (page - 1) * limit

    try {
        const where: any = {}

        // Status filter
        if (status && Object.values(TicketStatus).includes(status as TicketStatus)) {
            where.status = status
        }

        // Category filter
        if (category && Object.values(TicketCategory).includes(category as TicketCategory)) {
            where.category = category
        }

        // Priority filter
        if (priority && Object.values(TicketPriority).includes(priority as TicketPriority)) {
            where.priority = priority
        }

        // Assigned to current user filter
        if (assignedToMe) {
            where.assignedToId = user.id
        }

        // Search by ticket number or customer name
        if (search) {
            where.OR = [
                { ticketNumber: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { pelanggan: { nama: { contains: search, mode: 'insensitive' } } },
                { pelanggan: { idPelanggan: { contains: search, mode: 'insensitive' } } },
            ]
        }

        // Get tickets with last reply including message
        const [tickets, total] = await Promise.all([
            prisma.supportTickets.findMany({
                where,
                orderBy: [
                    { priority: 'desc' }, // URGENT first
                    { createdAt: 'desc' },
                ],
                skip,
                take: limit,
                include: {
                    pelanggan: {
                        select: {
                            id: true,
                            idPelanggan: true,
                            nama: true,
                            noTelp: true,
                            email: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    replies: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: {
                            createdAt: true,
                            isFromAdmin: true,
                            message: true, // Include message for rating extraction
                        },
                    },
                    _count: {
                        select: { replies: true },
                    },
                },
            }),
            prisma.supportTickets.count({ where }),
        ])

        // Get stats for all statuses
        const [openCount, inProgressCount, waitingCustomerCount, resolvedCount, closedCount] = await Promise.all([
            prisma.supportTickets.count({ where: { status: TicketStatus.OPEN } }),
            prisma.supportTickets.count({ where: { status: TicketStatus.IN_PROGRESS } }),
            prisma.supportTickets.count({ where: { status: TicketStatus.WAITING_CUSTOMER } }),
            prisma.supportTickets.count({ where: { status: TicketStatus.RESOLVED } }),
            prisma.supportTickets.count({ where: { status: TicketStatus.CLOSED } }),
        ])

        // Get closed tickets with ratings from replies
        const closedTicketsWithReplies = await prisma.supportTickets.findMany({
            where: { status: TicketStatus.CLOSED },
            include: {
                replies: {
                    where: {
                        isFromAdmin: false,
                        message: { contains: '⭐' }
                    },
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: { message: true }
                }
            }
        })

        // Calculate average rating
        let totalRating = 0
        let ratedCount = 0
        for (const t of closedTicketsWithReplies) {
            if (t.replies[0]?.message) {
                const msg = t.replies[0].message
                let rating = 0
                if (msg.includes('⭐⭐⭐⭐⭐')) rating = 5
                else if (msg.includes('⭐⭐⭐⭐')) rating = 4
                else if (msg.includes('⭐⭐⭐')) rating = 3
                else if (msg.includes('⭐⭐')) rating = 2
                else if (msg.includes('⭐')) rating = 1

                if (rating > 0) {
                    totalRating += rating
                    ratedCount++
                }
            }
        }
        const avgRating = ratedCount > 0 ? totalRating / ratedCount : 0

        return NextResponse.json({
            success: true,
            tickets: tickets.map((ticket) => ({
                ...ticket,
                lastReply: ticket.replies[0] || null,
                replyCount: ticket._count.replies,
                replies: undefined,
                _count: undefined,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            stats: {
                total: openCount + inProgressCount + waitingCustomerCount + resolvedCount + closedCount,
                open: openCount,
                inProgress: inProgressCount,
                waitingCustomer: waitingCustomerCount,
                resolved: resolvedCount,
                closed: closedCount,
                avgRating,
                ratedCount,
            },
        })
    } catch (error) {
        console.error('[Admin Support Tickets GET] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengambil daftar tiket' },
            { status: 500 }
        )
    }
}
