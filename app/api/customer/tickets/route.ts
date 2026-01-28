import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { SupportTicketService } from '@/modules/pelanggan/services/SupportTicketService'

const ticketService = new SupportTicketService()

/**
 * GET /api/customer/tickets
 * Get customer's support tickets
 * Refactored to use SupportTicketService (thin controller pattern)
 */
export async function GET(request: NextRequest) {
    const auth = await requireCustomerAuth(request)
    if (auth.response) return auth.response

    const { session } = auth
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status') || undefined

    try {
        const result = await ticketService.getCustomerTickets(
            session.id,
            page,
            limit,
            status
        )

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (error: any) {
        console.error('[Customer Tickets GET] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Gagal mengambil daftar tiket' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/customer/tickets
 * Create new support ticket
 * Refactored to use SupportTicketService (thin controller pattern)
 */
export async function POST(request: NextRequest) {
    const auth = await requireCustomerAuth(request)
    if (auth.response) return auth.response

    const { session } = auth

    try {
        const body = await request.json()
        const { category, subject, description, priority } = body

        const ticket = await ticketService.createTicket(session.id, {
            category,
            subject,
            description,
            priority,
        })

        return NextResponse.json({
            success: true,
            message: 'Tiket berhasil dibuat',
            ticket,
        })
    } catch (error: any) {
        console.error('[Customer Tickets POST] Error:', error)
        
        // Map validation errors to 400
        const validationErrors = [
            'Kategori, subjek, dan deskripsi wajib diisi',
            'Kategori tidak valid',
        ]
        const statusCode = validationErrors.includes(error.message) ? 400 : 500
        
        return NextResponse.json(
            { success: false, error: error.message || 'Gagal membuat tiket' },
            { status: statusCode }
        )
    }
}
