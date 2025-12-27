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
        const status = searchParams.get('status') // DRAFT, SENT, PAID, OVERDUE, CANCELLED
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')

        // Get customer to find pelangganId
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

        // Build where clause
        const where: any = {
            pelangganId: customer.id,
        }

        if (status) {
            where.status = status
        }

        // Get invoices with pagination
        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                orderBy: { issueDate: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    invoiceItem: true,
                    payment: {
                        orderBy: { paymentDate: 'desc' },
                        take: 1,
                    },
                },
            }),
            prisma.invoice.count({ where }),
        ])

        // Format response
        const formattedInvoices = invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            subtotal: Number(inv.subtotal),
            taxAmount: Number(inv.taxAmount),
            discountAmount: Number(inv.discountAmount),
            totalAmount: Number(inv.totalAmount),
            paidAmount: Number(inv.paidAmount),
            remainingAmount: Number(inv.totalAmount) - Number(inv.paidAmount),
            items: inv.invoiceItem.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                totalPrice: Number(item.totalPrice),
            })),
            lastpayment: inv.payment[0] ? {
                amount: Number(inv.payment[0].amount),
                date: inv.payment[0].paymentDate,
                method: inv.payment[0].paymentMethod,
            } : null,
        }))

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
    } catch (error) {
        console.error('[Customer Invoices Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
