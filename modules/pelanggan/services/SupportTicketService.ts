import { CustomerTicketRepository } from '../repositories/CustomerTicketRepository'
import { TicketCategory, TicketPriority } from '@prisma/client'
import { logActivitySafe } from '@/lib/logger'
import { TicketEventDispatcher } from '@/modules/events/dispatchers/TicketEventDispatcher'

/**
 * Service for customer support ticket business logic
 */
export class SupportTicketService {
    private repository: CustomerTicketRepository

    constructor() {
        this.repository = new CustomerTicketRepository()
    }

    /**
     * Get customer tickets with pagination
     */
    async getCustomerTickets(
        customerId: string,
        page: number = 1,
        limit: number = 10,
        status?: string
    ) {
        const { tickets, total } = await this.repository.findAllForCustomer(
            customerId,
            { page, limit, status }
        )

        return {
            tickets: this.repository.formatTicketsForResponse(tickets),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }
    }

    /**
     * Create new support ticket
     */
    async createTicket(
        customerId: string,
        data: {
            category: string
            subject: string
            description: string
            priority?: string
        }
    ) {
        // Validation
        if (!data.category || !data.subject || !data.description) {
            throw new Error('Kategori, subjek, dan deskripsi wajib diisi')
        }

        // Validate category
        if (!Object.values(TicketCategory).includes(data.category as TicketCategory)) {
            throw new Error('Kategori tidak valid')
        }

        // Generate ticket number: TKT-YYYYMMDD-XXXXX
        const today = new Date()
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
        const count = await this.repository.getCountForToday()
        const ticketNumber = `TKT-${dateStr}-${String(count + 1).padStart(5, '0')}`

        // Create ticket
        const ticket = await this.repository.create({
            pelangganId: customerId,
            ticketNumber,
            category: data.category as TicketCategory,
            priority: (data.priority as TicketPriority) || TicketPriority.MEDIUM,
            subject: data.subject,
            description: data.description,
        })

        // System Log
        logActivitySafe({
            action: 'CREATE',
            subject: 'Support Ticket',
            details: {
                customerId,
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
            },
        })

        // Publish domain event
        await TicketEventDispatcher.onCreated({
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            priority: ticket.priority,
            triggeredBy: customerId,
        }).catch(err => console.error('Failed to publish TICKET_CREATED event:', err))

        return {
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            category: ticket.category,
            priority: ticket.priority,
            subject: ticket.subject,
            status: ticket.status,
            createdAt: ticket.createdAt,
        }
    }
}
