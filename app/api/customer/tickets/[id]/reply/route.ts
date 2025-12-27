import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { TicketStatus } from '@prisma/client'
import { socketEmitter } from '@/lib/websocket/emitter'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/customer/tickets/[id]/reply
 * Customer replies to ticket
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const auth = await requireCustomerAuth(request)
    if (auth.response) return auth.response

    const { session } = auth
    const { id } = await params

    try {
        const body = await request.json()
        const { message, attachments } = body

        if ((!message || message.trim().length === 0) && (!attachments || attachments.length === 0)) {
            return NextResponse.json(
                { success: false, error: 'Pesan atau lampiran tidak boleh kosong' },
                { status: 400 }
            )
        }

        // Find ticket and verify ownership
        const ticket = await prisma.supportTickets.findUnique({
            where: {
                id,
                pelangganId: session.id,
            },
            include: {
                pelanggan: {
                    select: {
                        nama: true,
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
        const newReply = await prisma.ticketReplies.create({
            data: {
                id: crypto.randomUUID(),
                ticketId: id,
                pelangganId: session.id,
                isFromAdmin: false,
                message: message ? message.trim() : '',
                attachments: attachments || undefined,
            },
        })

        // Update ticket status to IN_PROGRESS if it was WAITING_CUSTOMER
        if (ticket.status === TicketStatus.WAITING_CUSTOMER) {
            await prisma.supportTickets.update({
                where: { id },
                data: { status: TicketStatus.IN_PROGRESS },
            })
        }

        // Emit WebSocket event for real-time chat
        socketEmitter.ticketMessage(id, {
            id: newReply.id,
            message: newReply.message,
            isFromAdmin: false,
            createdAt: newReply.createdAt.toISOString(),
            sender: {
                id: session.id,
                name: ticket.pelanggan?.nama || 'Pengguna',
            },
            attachments: newReply.attachments as string[] | null,
        })

        return NextResponse.json({
            success: true,
            message: 'Balasan berhasil dikirim',
            reply: {
                id: newReply.id,
                message: newReply.message,
                createdAt: newReply.createdAt,
                isFromAdmin: newReply.isFromAdmin,
                attachments: newReply.attachments,
            },
        })
    } catch (error) {
        console.error('[Customer Tickets Reply POST] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengirim balasan' },
            { status: 500 }
        )
    }
}

