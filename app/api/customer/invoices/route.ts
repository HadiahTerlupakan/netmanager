import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { CustomerInvoiceRepository } from '@/modules/pelanggan/repositories/CustomerInvoiceRepository'

const invoiceRepository = new CustomerInvoiceRepository()

/**
 * GET - Get customer invoices
 * Refactored to use CustomerInvoiceRepository (thin controller pattern)
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || undefined
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')

        const { invoices, total } = await invoiceRepository.findAllForCustomer(
            authResult.session.id,
            { page, limit, ...(status ? { status } : {}) }
        )

        const formattedInvoices = invoiceRepository.formatInvoicesForResponse(invoices)

        return NextResponse.json({
            success: true,
            invoices: formattedInvoices,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error: unknown) {
        console.error('[Customer Invoices Error]:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan server'
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        )
    }
}
