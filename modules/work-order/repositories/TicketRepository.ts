import { prisma } from '@/lib/prisma'
import { TicketStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

export class TicketRepository {
    async createReply(data: {
        id?: string
        ticketId: string
        message: string
        isFromAdmin?: boolean
        senderId?: string | null
        attachments?: string
    }) {
        return prisma.ticketReplies.create({
            data: {
                id: data.id || randomUUID(),
                ticketId: data.ticketId,
                message: data.message,
                isFromAdmin: data.isFromAdmin ?? true,
                senderId: data.senderId ?? null,
                attachments: data.attachments,
            },
        })
    }

    async updateStatus(ticketId: string, status: TicketStatus) {
        return prisma.supportTickets.update({
            where: { id: ticketId },
            data: { status },
        })
    }
}
