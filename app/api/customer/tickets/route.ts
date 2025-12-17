import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { TicketCategory, TicketPriority } from '@prisma/client'

/**
 * GET /api/customer/tickets
 * Get customer's support tickets
 */
export async function GET(request: NextRequest) {
    const auth = await requireCustomerAuth(request)
    if (auth.response) return auth.response

    const { session } = auth
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    try {
        const where = {
            pelangganId: session.id,
            ...(status && { status: status as any }),
        }

        const [tickets, total] = await Promise.all([
            prisma.supportTicket.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    replies: {
                        orderBy: { createdAt: 'desc' },
                        take: 1, // Get latest reply only
                    },
                    _count: {
                        select: { replies: true },
                    },
                },
            }),
            prisma.supportTicket.count({ where }),
        ])

        return NextResponse.json({
            success: true,
            tickets: tickets.map((ticket) => ({
                ...ticket,
                lastReply: ticket.replies[0] || null,
                replyCount: ticket._count.replies,
                replies: undefined,
                _count: undefined,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error('[Customer Tickets GET] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal mengambil daftar tiket' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/customer/tickets
 * Create new support ticket
 */
export async function POST(request: NextRequest) {
    const auth = await requireCustomerAuth(request)
    if (auth.response) return auth.response

    const { session } = auth

    try {
        const body = await request.json()
        const { category, subject, description, priority } = body

        // Validation
        if (!category || !subject || !description) {
            return NextResponse.json(
                { success: false, error: 'Kategori, subjek, dan deskripsi wajib diisi' },
                { status: 400 }
            )
        }

        // Validate category
        if (!Object.values(TicketCategory).includes(category)) {
            return NextResponse.json(
                { success: false, error: 'Kategori tidak valid' },
                { status: 400 }
            )
        }

        // Generate ticket number: TKT-YYYYMMDD-XXXXX
        const today = new Date()
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
        const count = await prisma.supportTicket.count({
            where: {
                createdAt: {
                    gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                },
            },
        })
        const ticketNumber = `TKT-${dateStr}-${String(count + 1).padStart(5, '0')}`

        // Create ticket
        const ticket = await prisma.supportTicket.create({
            data: {
                ticketNumber,
                pelangganId: session.id,
                category: category as TicketCategory,
                priority: (priority as TicketPriority) || TicketPriority.MEDIUM,
                subject,
                description,
            },
            include: {
                pelanggan: {
                    select: {
                        nama: true,
                        idPelanggan: true,
                    },
                },
            },
        })

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'CREATE',
                subject: 'Support Ticket',
                details: { customerId: session.id, id: ticket.id, ticketNumber: ticket.ticketNumber, subject: ticket.subject }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            message: 'Tiket berhasil dibuat',
            ticket: {
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                category: ticket.category,
                priority: ticket.priority,
                subject: ticket.subject,
                status: ticket.status,
                createdAt: ticket.createdAt,
            },
        })
    } catch (error) {
        console.error('[Customer Tickets POST] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal membuat tiket' },
            { status: 500 }
        )
    }
}
