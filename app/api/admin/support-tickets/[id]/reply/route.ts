import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { TicketStatus } from '@prisma/client'
import { WhatsAppService } from '@/modules/notification/services/whatsapp/whatsapp-service'
import { socketEmitter } from '@/lib/websocket/emitter'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'

/**
 * POST /api/admin/support-tickets/[id]/reply
 * Admin replies to a ticket
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const { id } = ctx.params

    const body = await req.json()
    const { message, updateStatus, sendWhatsApp = true, attachments } = body

    if ((!message || message.trim().length === 0) && (!attachments || attachments.length === 0)) {
        return apiError('Pesan atau lampiran tidak boleh kosong', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Find ticket
    const ticket = await prisma.supportTickets.findUnique({
        where: { id },
        include: {
            pelanggan: {
                select: {
                    id: true,
                    nama: true,
                    noTelp: true,
                    email: true,
                },
            },
        },
    })

    if (!ticket) {
        return ApiErrors.notFound('Tiket')
    }

    // Check if ticket is closed
    if (ticket.status === TicketStatus.CLOSED) {
        return apiError('Tiket sudah ditutup dan tidak dapat dibalas', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Create reply
    const reply = await prisma.ticketReplies.create({
        data: {
            id: randomUUID(),
            ticketId: id,
            senderId: user.id,
            isFromAdmin: true,
            message: message ? message.trim() : '',
            attachments: attachments || undefined,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    })

    // Update ticket status
    const newStatus = updateStatus || TicketStatus.WAITING_CUSTOMER
    await prisma.supportTickets.update({
        where: { id },
        data: {
            status: newStatus,
            assignedToId: ticket.assignedToId || user.id, // Auto-assign if not assigned
        },
    })

    // Emit WebSocket event for real-time chat
    socketEmitter.ticketMessage(id, {
        id: reply.id,
        message: reply.message,
        isFromAdmin: true,
        createdAt: reply.createdAt.toISOString(),
        sender: reply.user ? {
            id: reply.user.id,
            name: reply.user.name || 'Admin',
        } : null,
        attachments: reply.attachments as string[] | null,
    })

    // Send WhatsApp notification to customer
    let whatsappSent = false
    if (sendWhatsApp && ticket.pelanggan.noTelp) {
        try {
            const whatsappService = new WhatsAppService(prisma)
            const result = await whatsappService.sendMessage({
                phone: ticket.pelanggan.noTelp,
                message: `🎫 *Tiket Dukungan*\n\nHalo ${ticket.pelanggan.nama},\n\nTiket Anda *#${ticket.ticketNumber}* telah dibalas oleh tim kami:\n\n"${message.trim().substring(0, 500)}${message.length > 500 ? '...' : ''}"\n\nSilakan login ke portal pelanggan untuk melihat detail dan membalas.\n\nTerima kasih,\nTim Dukungan`,
            })
            whatsappSent = result.success
        } catch (waError) {
            console.error('[Admin Reply] WhatsApp error:', waError)
            // Don't fail the request if WhatsApp fails
        }
    }

    return apiSuccess({
        reply: {
            id: reply.id,
            message: reply.message,
            createdAt: reply.createdAt,
            isFromAdmin: reply.isFromAdmin,
            sender: reply.user,
        },
        whatsappSent,
    }, { message: 'Balasan berhasil dikirim' })
})
