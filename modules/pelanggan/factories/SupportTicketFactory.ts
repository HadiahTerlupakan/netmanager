/**
 * SupportTicketFactory
 *
 * Factory pattern for creating SupportTicket with different configurations.
 */

import type { TicketCategory, TicketPriority } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'


export interface CreateTicketInput {
    pelangganId: string
    ticketNumber: string
    category: TicketCategory
    priority: TicketPriority
    subject: string
    description: string
}

export class SupportTicketFactory {
    /**
     * Create input for billing/payment issue ticket
     */
    static async createBillingTicket(dto: {
        pelangganId: string
        subject: string
        description: string
        invoiceNumber?: string
        tenantId?: string
    }): Promise<CreateTicketInput> {
        const ticketNumber = await this.generateTicketNumber(dto.tenantId)

        let desc = dto.description
        if (dto.invoiceNumber) {
            desc = `Invoice: ${dto.invoiceNumber}\n\n${dto.description}`
        }

        return {
            pelangganId: dto.pelangganId,
            ticketNumber,
            category: 'BILLING' as TicketCategory,
            priority: 'MEDIUM' as TicketPriority,
            subject: dto.subject,
            description: desc,
        }
    }

    /**
     * Create input for technical/connection issue ticket
     */
    static async createTechnicalTicket(dto: {
        pelangganId: string
        subject: string
        description: string
        isUrgent?: boolean
        tenantId?: string
    }): Promise<CreateTicketInput> {
        const ticketNumber = await this.generateTicketNumber(dto.tenantId)

        return {
            pelangganId: dto.pelangganId,
            ticketNumber,
            category: 'TECHNICAL' as TicketCategory,
            priority: dto.isUrgent ? 'HIGH' as TicketPriority : 'MEDIUM' as TicketPriority,
            subject: dto.subject,
            description: dto.description,
        }
    }

    /**
     * Create input for general inquiry ticket
     */
    static async createGeneralTicket(dto: {
        pelangganId: string
        subject: string
        description: string
        tenantId?: string
    }): Promise<CreateTicketInput> {
        const ticketNumber = await this.generateTicketNumber(dto.tenantId)

        return {
            pelangganId: dto.pelangganId,
            ticketNumber,
            category: 'GENERAL' as TicketCategory,
            priority: 'LOW' as TicketPriority,
            subject: dto.subject,
            description: dto.description,
        }
    }

    /**
     * Create input for complaint ticket
     */
    static async createComplaintTicket(dto: {
        pelangganId: string
        subject: string
        description: string
        tenantId?: string
    }): Promise<CreateTicketInput> {
        const ticketNumber = await this.generateTicketNumber(dto.tenantId)

        return {
            pelangganId: dto.pelangganId,
            ticketNumber,
            category: 'COMPLAINT' as TicketCategory,
            priority: 'HIGH' as TicketPriority,
            subject: dto.subject,
            description: dto.description,
        }
    }

    /**
     * Generate ticket number: TKT-YYYYMMDD-XXXXX
     */
    static async generateTicketNumber(tenantId?: string): Promise<string> {
        const today = new Date()
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

        const startOfDay = new Date(today.setTime(toStartOfDay(today).getTime()))
        const endOfDay = new Date(today.setTime(toEndOfDay(today).getTime()))

        const count = await prisma.supportTickets.count({
            where: {
                tenantId: tenantId,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                }
            }
        })

        return `TKT-${dateStr}-${String(count + 1).padStart(5, '0')}`
    }

    /**
     * Determine priority based on keywords
     */
    static determinePriority(text: string): TicketPriority {
        const lowercaseText = text.toLowerCase()

        // High priority keywords
        const urgentKeywords = ['urgent', 'darurat', 'tidak bisa', 'mati total', 'putus', 'down', 'emergency']
        if (urgentKeywords.some(kw => lowercaseText.includes(kw))) {
            return 'HIGH' as TicketPriority
        }

        // Low priority keywords
        const lowKeywords = ['tanya', 'informasi', 'info', 'cara', 'bagaimana']
        if (lowKeywords.some(kw => lowercaseText.includes(kw))) {
            return 'LOW' as TicketPriority
        }

        return 'MEDIUM' as TicketPriority
    }
}
