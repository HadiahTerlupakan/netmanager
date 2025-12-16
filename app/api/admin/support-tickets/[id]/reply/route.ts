import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { TicketStatus } from '@prisma/client'
import { WhatsAppService } from '@/lib/services/whatsapp/whatsapp-service'
import { socketEmitter } from '@/lib/websocket/emitter'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/admin/support-tickets/[id]/reply
 * Admin replies to a ticket
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const user = await verifyAuth(request)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const { message, updateStatus, sendWhatsApp = true, attachments } = body

        if ((!message || message.trim().length === 0) && (!attachments || attachments.length === 0)) {
            return NextResponse.json(
                { success: false, error: 'Pesan atau lampiran tidak boleh kosong' },
                { status: 400 }
            )
        }

        // Find ticket
        const ticket = await prisma.supportTicket.findUnique({
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
            return NextResponse.json(
                { success: false, error: 'Tiket tidak ditemukan' },
                { status: 404 }
            )
        }

        // Check if ticket is closed
        if (ticket.status === TicketStatus.CLOSED) {
            return NextResponse.json(
                { success: false, error: 'Tiket sudah ditutup dan tidak dapat dibalas' },
                { status: 400 }
            )
        }

        // Create reply
        const reply = await prisma.ticketReply.create({
            data: {
                ticketId: id,
                senderId: user.id,
                isFromAdmin: true,
                message: message ? message.trim() : '',
                attachments: attachments || undefined,
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        })

        // Update ticket status
        const newStatus = updateStatus || TicketStatus.WAITING_CUSTOMER
        await prisma.supportTicket.update({
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
            sender: reply.sender ? {
                id: reply.sender.id,
                name: reply.sender.name || 'Admin',
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

        return NextResponse.json({
            success: true,
            message: 'Balasan berhasil dikirim',
            reply: {
                id: reply.id,
                message: reply.message,
                createdAt: reply.createdAt,
                isFromAdmin: reply.isFromAdmin,
                sender: reply.sender,
            },
            whatsappSent,
        })
    } catch (error) {
        console.error('[Admin Support Ticket Reply POST] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengirim balasan' },
            { status: 500 }
        )
    }
}
