import { prisma } from '@/lib/prisma'
import { Prisma, TicketCategory, TicketPriority, TicketStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * Type for ticket with its relations used in this repository
 */
type TicketWithRelations = Prisma.SupportTicketsGetPayload<{
    include: {
        replies: true,
        _count: {
            select: { replies: true },
        },
    }
}>

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
            ...(status && { status: status as TicketStatus }),
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
    formatTicketsForResponse(tickets: TicketWithRelations[]) {
        return tickets.map((ticket) => {
            const { replies, _count, ...rest } = ticket
            return {
                ...rest,
                lastReply: replies[0] || null,
                replyCount: _count.replies,
            }
        })
    }

    // ============================================
    // Admin Methods
    // ============================================

    async findAllAdmin(where: Prisma.SupportTicketsWhereInput, skip: number, take: number) {
        return prisma.supportTickets.findMany({
            where,
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' },
            ],
            skip,
            take,
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
                    select: { id: true, name: true },
                },
                replies: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        createdAt: true,
                        isFromAdmin: true,
                        message: true,
                    },
                },
                _count: {
                    select: { replies: true },
                },
            },
        })
    }

    async countAdmin(where: Prisma.SupportTicketsWhereInput) {
        return prisma.supportTickets.count({ where })
    }

    async getStatusCounts(where: Prisma.SupportTicketsWhereInput) {
        return prisma.supportTickets.groupBy({
            by: ['status'],
            where,
            _count: {
                status: true
            }
        })
    }

    async getClosedTicketsWithReplies(where: Prisma.SupportTicketsWhereInput) {
        return prisma.supportTickets.findMany({
            where: { ...where, status: TicketStatus.CLOSED },
            select: {
                replies: {
                    where: { isFromAdmin: false, message: { contains: '⭐' } },
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: { message: true },
                },
            },
        })
    }

    async findByIdAdmin(id: string) {
        return prisma.supportTickets.findUnique({
            where: { id },
            include: {
                pelanggan: {
                    select: {
                        id: true,
                        idPelanggan: true,
                        nama: true,
                        username: true,
                        email: true,
                        noTelp: true,
                        alamat: true,
                        status: true,
                        siteId: true,
                        hargaPaket: {
                            select: { name: true },
                        },
                    },
                },
                user: {
                    select: { id: true, name: true, email: true },
                },
                replies: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: {
                            select: { id: true, name: true, image: true },
                        },
                    },
                },
            },
        })
    }

    async findByIdBasic(id: string) {
        return prisma.supportTickets.findUnique({
            where: { id },
            include: {
                pelanggan: { select: { siteId: true, nama: true } },
            },
        })
    }

    async updateAdmin(id: string, updateData: Prisma.SupportTicketsUpdateInput) {
        return prisma.supportTickets.update({
            where: { id },
            data: updateData,
            include: {
                pelanggan: {
                    select: { nama: true, idPelanggan: true },
                },
                user: {
                    select: { name: true },
                },
            },
        })
    }

    async createReply(data: { ticketId: string; message: string; isFromAdmin: boolean; senderId?: string }) {
        return prisma.ticketReplies.create({
            data: {
                id: randomUUID(),
                ticketId: data.ticketId,
                message: data.message,
                isFromAdmin: data.isFromAdmin,
                senderId: data.senderId,
            },
        })
    }

    async delete(id: string) {
        return prisma.supportTickets.delete({ where: { id } })
    }
}

