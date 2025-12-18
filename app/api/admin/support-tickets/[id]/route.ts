import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { TicketStatus } from '@prisma/client'
import { closeWoOnTicketClose } from '@/modules/work-order/services/WorkOrderSyncService'

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/admin/support-tickets/[id]
 * Get ticket detail with all replies
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const user = await verifyAuth(request)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    try {
        const ticket = await prisma.supportTicket.findUnique({
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
                        hargaPaket: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
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
        console.error('[Admin Support Ticket GET Detail] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengambil detail tiket' },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/admin/support-tickets/[id]
 * Update ticket (status, priority, assignee)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const user = await verifyAuth(request)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const { status, priority, assignedToId } = body

        // Find ticket first
        const existingTicket = await prisma.supportTicket.findUnique({
            where: { id },
        })

        if (!existingTicket) {
            return NextResponse.json(
                { success: false, error: 'Tiket tidak ditemukan' },
                { status: 404 }
            )
        }

        const updateData: any = {}

        // Update status
        if (status && Object.values(TicketStatus).includes(status)) {
            updateData.status = status

            // Set resolved/closed timestamps
            if (status === TicketStatus.RESOLVED && !existingTicket.resolvedAt) {
                updateData.resolvedAt = new Date()
            }
            if (status === TicketStatus.CLOSED && !existingTicket.closedAt) {
                updateData.closedAt = new Date()
            }
        }

        // Update priority
        if (priority) {
            updateData.priority = priority
        }

        // Update assignee
        if (assignedToId !== undefined) {
            updateData.assignedToId = assignedToId || null
        }

        const ticket = await prisma.supportTicket.update({
            where: { id },
            data: updateData,
            include: {
                pelanggan: {
                    select: {
                        nama: true,
                        idPelanggan: true,
                    },
                },
                assignedTo: {
                    select: {
                        name: true,
                    },
                },
            },
        })

        // Handle closing logic side effects
        if (status === TicketStatus.CLOSED) {
            // 1. Send closing note if exists
            const { closingNote } = body
            if (closingNote) {
                await prisma.ticketReply.create({
                    data: {
                        ticketId: id,
                        message: closingNote,
                        isFromAdmin: true,
                        senderId: user.id
                    }
                })
            }

            // 2. Auto-close related Work Orders
            await closeWoOnTicketClose(id)
        }

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Support Ticket',
                userId: user.id,
                details: { id: ticket.id, updates: updateData }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            message: 'Tiket berhasil diupdate',
            ticket,
        })
    } catch (error) {
        console.error('[Admin Support Ticket PATCH] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengupdate tiket' },
            { status: 500 }
        )
    }
}
