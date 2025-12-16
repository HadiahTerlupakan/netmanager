import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customer-auth'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/customer/tickets/[id]
 * Get ticket detail with replies
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const auth = await requireCustomerAuth(request)
    if (auth.response) return auth.response

    const { session } = auth
    const { id } = await params

    try {
        const ticket = await prisma.supportTicket.findFirst({
            where: {
                id,
                pelangganId: session.id, // Ensure customer owns this ticket
            },
            include: {
                replies: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                            },
                        },
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
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

        return NextResponse.json({
            success: true,
            ticket,
        })
    } catch (error) {
        console.error('[Customer Tickets GET Detail] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengambil detail tiket' },
            { status: 500 }
        )
    }
}
