import { prisma } from '@/lib/prisma'
import { Prisma, TicketCategory, TicketPriority } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * Repository for customer support ticket operations
 */
export class CustomerTicketRepository {
    /**
     * Get tickets for a customer with pagination
     */
    async findAllForCustomer(
        pelangganId: string,
        options: {
            page: number
            limit: number
            status?: string
        }
    ) {
        const { page, limit, status } = options
        const skip = (page - 1) * limit

        const where: Prisma.SupportTicketsWhereInput = {
            pelangganId,
            ...(status && { status: status as any }),
        }

        const [tickets, total] = await Promise.all([
            prisma.supportTickets.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    replies: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                    _count: {
                        select: { replies: true },
                    },
                },
            }),
            prisma.supportTickets.count({ where }),
        ])

        return { tickets, total }
    }

    /**
     * Get count of tickets for today (for ticket number generation)
     */
    async getCountForToday(): Promise<number> {
        const today = new Date()
        return prisma.supportTickets.count({
            where: {
                createdAt: {
                    gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                },
            },
        })
    }

    /**
     * Create a new support ticket
     */
    async create(data: {
        pelangganId: string
        ticketNumber: string
        category: TicketCategory
        priority: TicketPriority
        subject: string
        description: string
    }) {
        return prisma.supportTickets.create({
            data: {
                id: randomUUID(),
                ticketNumber: data.ticketNumber,
                pelangganId: data.pelangganId,
                category: data.category,
                priority: data.priority,
                subject: data.subject,
                description: data.description,
                updatedAt: new Date(),
            },
            include: {
                pelanggan: {
                    select: {
                        nama: true,
                        idPelanggan: true,
                    },
                },
            },
        })
    }

    /**
     * Format tickets for API response
     */
    formatTicketsForResponse(tickets: any[]) {
        return tickets.map((ticket) => ({
            ...ticket,
            lastReply: ticket.replies[0] || null,
            replyCount: ticket._count.replies,
            replies: undefined,
            _count: undefined,
        }))
    }
}
