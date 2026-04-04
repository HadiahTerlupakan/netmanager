import { TicketStatus, TicketCategory, TicketPriority, Prisma } from '@prisma/client'
import { CustomerTicketRepository } from '../repositories/CustomerTicketRepository'
import { logActivitySafe } from '@/lib/logger'
import { isPrismaRecordNotFoundError } from '@/lib/prisma-errors'
import { closeWoOnTicketClose } from '@/modules/work-order/services/WorkOrderSyncService'
import { TicketEventDispatcher } from '@/modules/events'

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
    private ticketRepo: CustomerTicketRepository

    constructor() {
        this.ticketRepo = new CustomerTicketRepository()
    }

    /**
     * Get paginated list of tickets with filters and stats
     */
    async getTickets(
        filters: TicketFilterOptions,
        user: UserContext,
        hasSiteRestriction: boolean
    ): Promise<ServiceResult<{
        tickets: unknown[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
        stats: Record<string, unknown>
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
            const where: Prisma.SupportTicketsWhereInput = {}

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
                this.ticketRepo.findAllAdmin(where, skip, limit),
                this.ticketRepo.countAdmin(where),
                this.getStatusCounts(where),
            ])

            // Calculate average rating
            const { avgRating, ratedCount } = await this.calculateAverageRating(where)

            // Format response
            const formattedTickets = tickets.map((ticket) => {
                const { replies, _count, ...rest } = ticket
                return {
                    ...rest,
                    lastReply: replies[0] || null,
                    replyCount: _count.replies,
                }
            })

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
    ): Promise<ServiceResult<unknown>> {
        try {
            const ticket = await this.ticketRepo.findByIdAdmin(id)

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
    ): Promise<ServiceResult<unknown>> {
        try {
            const existing = await this.ticketRepo.findByIdBasic(id)

            if (!existing) {
                return { success: false, error: 'Tiket tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Site restriction check
            if (hasSiteRestriction && user.role !== 'SUPER_ADMIN') {
                if (!user.siteId || existing.pelanggan?.siteId !== user.siteId) {
                    return { success: false, error: 'Akses ditolak', code: 'FORBIDDEN' }
                }
            }

            const updateData: Prisma.SupportTicketsUpdateInput = {}

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
                // Use explicit type casting or handle relations if needed
                updateData.user = data.assignedToId ? { connect: { id: data.assignedToId } } : { disconnect: true }
            }

            const ticket = await this.ticketRepo.updateAdmin(id, updateData)

            // Handle closing side effects
            if (data.status === TicketStatus.CLOSED) {
                if (data.closingNote) {
                    await this.ticketRepo.createReply({
                        ticketId: id,
                        message: data.closingNote,
                        isFromAdmin: true,
                        senderId: user.id,
                    })
                }
                await closeWoOnTicketClose(id)
            }

            // Log activity
            await this.logActivity('UPDATE', 'Support Ticket', user.id, { id, updates: updateData })

            // Publish domain event for status change
            if (data.status && data.status !== existing.status) {
                await TicketEventDispatcher.onStatusChanged({
                    ticketId: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    subject: existing.subject,
                    priority: ticket.priority,
                    pelangganNama: ticket.pelanggan?.nama,
                    siteId: existing.pelanggan?.siteId,
                    triggeredBy: user.id,
                }).catch(err => console.error('Failed to publish TICKET_STATUS_CHANGED event:', err))
            }

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
            const ticket = await this.ticketRepo.findByIdBasic(id)

            if (!ticket) {
                return { success: false, error: 'Tiket tidak ditemukan', code: 'NOT_FOUND' }
            }

            // Site restriction check
            if (hasSiteRestriction && user.role !== 'SUPER_ADMIN') {
                if (!user.siteId || ticket.pelanggan?.siteId !== user.siteId) {
                    return { success: false, error: 'Akses ditolak', code: 'FORBIDDEN' }
                }
            }

            await this.ticketRepo.delete(id)

            // Log activity
            await this.logActivity('DELETE', 'Support Ticket', user.id, { id })

            return { success: true, data: { id } }
        } catch (error) {
            console.error('[AdminSupportTicketService.deleteTicket] Error:', error)
            if (isPrismaRecordNotFoundError(error)) {
                return { success: false, error: 'Tiket tidak ditemukan', code: 'NOT_FOUND' }
            }
            return { success: false, error: 'Gagal menghapus tiket', code: 'INTERNAL_ERROR' }
        }
    }

    // ====== PRIVATE HELPERS ======

    private async getStatusCounts(baseWhere: Prisma.SupportTicketsWhereInput) {
        // Optimization: Use groupBy instead of 5 separate count queries
        const counts = await this.ticketRepo.getStatusCounts(baseWhere)

        const countMap = counts.reduce((acc, curr) => {
            acc[curr.status] = curr._count.status
            return acc
        }, {} as Record<string, number>)

        const open = countMap[TicketStatus.OPEN] || 0
        const inProgress = countMap[TicketStatus.IN_PROGRESS] || 0
        const waitingCustomer = countMap[TicketStatus.WAITING_CUSTOMER] || 0
        const resolved = countMap[TicketStatus.RESOLVED] || 0
        const closed = countMap[TicketStatus.CLOSED] || 0

        return {
            total: open + inProgress + waitingCustomer + resolved + closed,
            open,
            inProgress,
            waitingCustomer,
            resolved,
            closed,
        }
    }

    private async calculateAverageRating(baseWhere: Prisma.SupportTicketsWhereInput) {
        // Optimization: parse logic is still heavy in application layer due to string storage
        // but we ensure we only select minimal data
        const closedTicketsWithReplies = await this.ticketRepo.getClosedTicketsWithReplies(baseWhere)

        let totalRating = 0
        let ratedCount = 0

        for (const t of closedTicketsWithReplies) {
            if (t.replies[0]?.message) {
                const msg = t.replies[0].message
                // Optimize string checking order (most likely first)
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

    private logActivity(action: string, subject: string, userId: string, details: Record<string, unknown>) {
        logActivitySafe({ action, subject, userId, details })
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
