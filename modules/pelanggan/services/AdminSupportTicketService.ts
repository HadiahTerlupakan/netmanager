import { prisma } from '@/lib/prisma'
import { TicketStatus, TicketCategory, TicketPriority } from '@prisma/client'
import { logger } from '@/lib/logger'
import { closeWoOnTicketClose } from '@/modules/work-order/services/WorkOrderSyncService'
import { randomUUID } from 'crypto'

/**
 * Service Result type for consistent API responses
 */
export interface ServiceResult<T> {
    success: boolean
    data?: T
    error?: string
    code?: string
}

/**
 * Filter options for listing tickets
 */
export interface TicketFilterOptions {
    page?: number
    limit?: number
    status?: TicketStatus
    category?: TicketCategory
    priority?: TicketPriority
    search?: string
    assignedToMe?: boolean
    siteId?: string // For site restriction
}

/**
 * User context for permission checks
 */
export interface UserContext {
    id: string
    role?: string
    siteId?: string | null
    permissions?: string[]
}

/**
 * Admin Support Ticket Service
 * Handles all support ticket business logic for admin panel
 */
export class AdminSupportTicketService {

    /**
     * Get paginated list of tickets with filters and stats
     */
    async getTickets(
        filters: TicketFilterOptions,
        user: UserContext,
        hasSiteRestriction: boolean
    ): Promise<ServiceResult<{
        tickets: any[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
        stats: Record<string, any>
    }>> {
        try {
            const {
                page = 1,
                limit = 20,
                status,
                category,
                priority,
                search,
                assignedToMe,
            } = filters

            const skip = (page - 1) * limit
            const where: any = {}

            // Site restriction check
            if (hasSiteRestriction && user.role !== 'SUPER_ADMIN') {
                if (!user.siteId) {
                    return { success: false, error: 'User tidak memiliki akses site', code: 'FORBIDDEN' }
                }
                where.pelanggan = { siteId: user.siteId }
            }

            // Apply filters
            if (status && Object.values(TicketStatus).includes(status)) {
                where.status = status
            }
            if (category && Object.values(TicketCategory).includes(category)) {
                where.category = category
            }
            if (priority && Object.values(TicketPriority).includes(priority)) {
                where.priority = priority
            }
            if (assignedToMe) {
                where.assignedToId = user.id
            }

            // Search
            if (search) {
                where.OR = [
                    { ticketNumber: { contains: search, mode: 'insensitive' } },
                    { subject: { contains: search, mode: 'insensitive' } },
                    { pelanggan: { nama: { contains: search, mode: 'insensitive' } } },
                    { pelanggan: { idPelanggan: { contains: search, mode: 'insensitive' } } },
                ]
            }

            // Execute queries
            const [tickets, total, statusSummary] = await Promise.all([
                prisma.supportTickets.findMany({
                    where,
                    orderBy: [
                        { priority: 'desc' },
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
                }),
                prisma.supportTickets.count({ where }),
                this.getStatusCounts(where),
            ])

            // Calculate average rating
            const { avgRating, ratedCount } = await this.calculateAverageRating(where)

            // Format response
            const formattedTickets = tickets.map((ticket) => ({
                ...ticket,
                lastReply: ticket.replies[0] || null,
                replyCount: ticket._count.replies,
                replies: undefined,
                _count: undefined,
            }))

            return {
                success: true,
                data: {
                    tickets: formattedTickets,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                    stats: {
                        ...statusSummary,
                        avgRating,
                        ratedCount,
                    },
                },
            }
        } catch (error) {
            console.error('[AdminSupportTicketService.getTickets] Error:', error)
            return { success: false, error: 'Gagal mengambil daftar tiket', code: 'INTERNAL_ERROR' }
        }
    }

    /**
     * Get single ticket with all replies
     */
    async getTicketById(
        id: string,
        user: UserContext,
        hasSiteRestriction: boolean
    ): Promise<ServiceResult<any>> {
        try {
            const ticket = await prisma.supportTickets.findUnique({
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

            if (!ticket) {
                return { success: false, error: 'Tiket tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Site restriction check
            if (hasSiteRestriction && user.role !== 'SUPER_ADMIN') {
                if (!user.siteId || ticket.pelanggan?.siteId !== user.siteId) {
                    return { success: false, error: 'Akses ditolak', code: 'FORBIDDEN' }
                }
            }

            return { success: true, data: ticket }
        } catch (error) {
            console.error('[AdminSupportTicketService.getTicketById] Error:', error)
            return { success: false, error: 'Gagal mengambil detail tiket', code: 'INTERNAL_ERROR' }
        }
    }

    /**
     * Update ticket (status, priority, assignee)
     */
    async updateTicket(
        id: string,
        data: {
            status?: TicketStatus
            priority?: TicketPriority
            assignedToId?: string | null
            closingNote?: string
        },
        user: UserContext,
        hasSiteRestriction: boolean
    ): Promise<ServiceResult<any>> {
        try {
            const existing = await prisma.supportTickets.findUnique({
                where: { id },
                include: {
                    pelanggan: { select: { siteId: true } },
                },
            })

            if (!existing) {
                return { success: false, error: 'Tiket tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Site restriction check
            if (hasSiteRestriction && user.role !== 'SUPER_ADMIN') {
                if (!user.siteId || existing.pelanggan?.siteId !== user.siteId) {
                    return { success: false, error: 'Akses ditolak', code: 'FORBIDDEN' }
                }
            }

            const updateData: any = {}

            // Status update
            if (data.status && Object.values(TicketStatus).includes(data.status)) {
                updateData.status = data.status

                if (data.status === TicketStatus.RESOLVED && !existing.resolvedAt) {
                    updateData.resolvedAt = new Date()
                }
                if (data.status === TicketStatus.CLOSED && !existing.closedAt) {
                    updateData.closedAt = new Date()
                }
            }

            // Priority update
            if (data.priority) {
                updateData.priority = data.priority
            }

            // Assignee update
            if (data.assignedToId !== undefined) {
                updateData.assignedToId = data.assignedToId || null
            }

            const ticket = await prisma.supportTickets.update({
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

            // Handle closing side effects
            if (data.status === TicketStatus.CLOSED) {
                if (data.closingNote) {
                    await prisma.ticketReplies.create({
                        data: {
                            id: randomUUID(),
                            ticketId: id,
                            message: data.closingNote,
                            isFromAdmin: true,
                            senderId: user.id,
                        },
                    })
                }
                await closeWoOnTicketClose(id)
            }

            // Log activity
            await this.logActivity('UPDATE', 'Support Ticket', user.id, { id, updates: updateData })

            return { success: true, data: ticket }
        } catch (error) {
            console.error('[AdminSupportTicketService.updateTicket] Error:', error)
            return { success: false, error: 'Gagal mengupdate tiket', code: 'INTERNAL_ERROR' }
        }
    }

    /**
     * Delete ticket
     */
    async deleteTicket(
        id: string,
        user: UserContext,
        hasSiteRestriction: boolean
    ): Promise<ServiceResult<{ id: string }>> {
        try {
            const ticket = await prisma.supportTickets.findUnique({
                where: { id },
                include: {
                    pelanggan: { select: { siteId: true } },
                },
            })

            if (!ticket) {
                return { success: false, error: 'Tiket tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Site restriction check
            if (hasSiteRestriction && user.role !== 'SUPER_ADMIN') {
                if (!user.siteId || ticket.pelanggan?.siteId !== user.siteId) {
                    return { success: false, error: 'Akses ditolak', code: 'FORBIDDEN' }
                }
            }

            await prisma.supportTickets.delete({ where: { id } })

            // Log activity
            await this.logActivity('DELETE', 'Support Ticket', user.id, { id })

            return { success: true, data: { id } }
        } catch (error) {
            console.error('[AdminSupportTicketService.deleteTicket] Error:', error)
            return { success: false, error: 'Gagal menghapus tiket', code: 'INTERNAL_ERROR' }
        }
    }

    // ====== PRIVATE HELPERS ======

    private async getStatusCounts(baseWhere: any) {
        const [open, inProgress, waitingCustomer, resolved, closed] = await Promise.all([
            prisma.supportTickets.count({ where: { ...baseWhere, status: TicketStatus.OPEN } }),
            prisma.supportTickets.count({ where: { ...baseWhere, status: TicketStatus.IN_PROGRESS } }),
            prisma.supportTickets.count({ where: { ...baseWhere, status: TicketStatus.WAITING_CUSTOMER } }),
            prisma.supportTickets.count({ where: { ...baseWhere, status: TicketStatus.RESOLVED } }),
            prisma.supportTickets.count({ where: { ...baseWhere, status: TicketStatus.CLOSED } }),
        ])

        return {
            total: open + inProgress + waitingCustomer + resolved + closed,
            open,
            inProgress,
            waitingCustomer,
            resolved,
            closed,
        }
    }

    private async calculateAverageRating(baseWhere: any) {
        const closedTicketsWithReplies = await prisma.supportTickets.findMany({
            where: { ...baseWhere, status: TicketStatus.CLOSED },
            include: {
                replies: {
                    where: { isFromAdmin: false, message: { contains: '⭐' } },
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: { message: true },
                },
            },
        })

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

        return {
            avgRating: ratedCount > 0 ? totalRating / ratedCount : 0,
            ratedCount,
        }
    }

    private async logActivity(action: string, subject: string, userId: string, details: any) {
        try {
            await logger.logActivity({ action, subject, userId, details })
        } catch (e) {
            console.error('[AdminSupportTicketService] Logging failed', e)
        }
    }
}

// Singleton instance
let serviceInstance: AdminSupportTicketService | null = null

export function getAdminSupportTicketService(): AdminSupportTicketService {
    if (!serviceInstance) {
        serviceInstance = new AdminSupportTicketService()
    }
    return serviceInstance
}
