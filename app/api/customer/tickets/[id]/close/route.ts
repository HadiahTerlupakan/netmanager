import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { TicketStatus } from '@prisma/client'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/customer/tickets/[id]/close
 * Customer closes their own ticket
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const auth = await requireCustomerAuth(request)
    if (auth.response) return auth.response

    const { session } = auth
    const { id } = await params

    try {
        const body = await request.json().catch(() => ({}))
        const { feedback, rating } = body // Optional feedback and rating

        // Find ticket and verify ownership
        const ticket = await prisma.supportTicket.findUnique({
            where: { id },
            select: {
                id: true,
                pelangganId: true,
                status: true,
            },
        })

        if (!ticket) {
            return NextResponse.json(
                { success: false, error: 'Tiket tidak ditemukan' },
                { status: 404 }
            )
        }

        if (ticket.pelangganId !== session.id) {
            return NextResponse.json(
                { success: false, error: 'Anda tidak memiliki akses ke tiket ini' },
                { status: 403 }
            )
        }

        if (ticket.status === TicketStatus.CLOSED) {
            return NextResponse.json(
                { success: false, error: 'Tiket sudah ditutup' },
                { status: 400 }
            )
        }

        // Get rating label
        const getRatingLabel = (r: number) => {
            switch (r) {
                case 1: return '⭐ Tidak Puas'
                case 2: return '⭐⭐ Kurang Puas'
                case 3: return '⭐⭐⭐ Cukup Puas'
                case 4: return '⭐⭐⭐⭐ Puas'
                case 5: return '⭐⭐⭐⭐⭐ Sangat Puas'
                default: return ''
            }
        }

        // Close the ticket with rating
        const updateData: any = {
            status: TicketStatus.CLOSED,
            closedAt: new Date(),
        }

        // Store rating if provided (we'll add to message since schema might not have rating field)
        await prisma.supportTicket.update({
            where: { id },
            data: updateData,
        })

        // Build closing message with rating
        let closingMessage = '✅ Tiket ditutup oleh pelanggan.'

        if (rating && rating >= 1 && rating <= 5) {
            closingMessage += `\n\n📊 Rating: ${getRatingLabel(rating)}`
        }

        if (feedback && feedback.trim()) {
            closingMessage += `\n\n💬 Feedback:\n${feedback.trim()}`
        }

        await prisma.ticketReply.create({
            data: {
                ticketId: id,
                pelangganId: session.id,
                isFromAdmin: false,
                message: closingMessage,
            },
        })

        return NextResponse.json({
            success: true,
            message: 'Tiket berhasil ditutup. Terima kasih telah menghubungi kami!',
        })
    } catch (error) {
        console.error('[Customer Ticket Close] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal menutup tiket' },
            { status: 500 }
        )
    }
}
