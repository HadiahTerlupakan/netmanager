import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')

        // Get customer ID
        const customer = await prisma.pelanggan.findUnique({
            where: { id: authResult.session.id },
            select: { id: true },
        })

        if (!customer) {
            return NextResponse.json(
                { error: 'Data pelanggan tidak ditemukan' },
                { status: 404 }
            )
        }

        // Get payments with pagination
        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where: { pelangganId: customer.id },
                orderBy: { paymentDate: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    invoice: {
                        select: {
                            invoiceNumber: true,
                            status: true,
                        },
                    },
                },
            }),
            prisma.payment.count({ where: { pelangganId: customer.id } }),
        ])

        // Format response
        const formattedPayments = payments.map((pay) => ({
            id: pay.id,
            amount: Number(pay.amount),
            paymentDate: pay.paymentDate,
            paymentMethod: pay.paymentMethod,
            reference: pay.reference,
            notes: pay.notes,
            invoice: pay.invoice ? {
                invoiceNumber: pay.invoice.invoiceNumber,
                status: pay.invoice.status,
            } : null,
            verified: !!pay.verifiedAt,
        }))

        // Calculate summary
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)

        return NextResponse.json({
            success: true,
            payments: formattedPayments,
            summary: {
                totalPaid,
                transactionCount: total,
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error('[Customer Payments Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
