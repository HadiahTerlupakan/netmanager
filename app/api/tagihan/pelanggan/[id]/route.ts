import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authConfig)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const pelangganId = id

        // Fetch invoices for this customer
        const invoices = await prisma.invoice.findMany({
            where: {
                pelangganId: pelangganId
            },
            include: {
                payment: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        // Map Invoice to legacy Tagihan format
        const tagihans = invoices.map(invoice => {
            let status = 'BELUM_LUNAS'
            if (invoice.status === 'PAID') status = 'LUNAS'
            else if (invoice.status === 'OVERDUE') status = 'TERLAMBAT'
            else if (invoice.status === 'CANCELLED') status = 'LUNAS' // Or handle as null? Keep it simple for now.

            const date = new Date(invoice.createdAt)
            const paymentMethod = invoice.payment.length > 0 ? invoice.payment[0].paymentMethod : null

            return {
                id: invoice.id,
                noTagihan: invoice.invoiceNumber,
                periodeBulan: date.getMonth() + 1,
                periodeTahun: date.getFullYear(),
                subtotal: Number(invoice.subtotal),
                diskon: Number(invoice.discountAmount),
                ppn: Number(invoice.taxAmount),
                // Old fields not present in Invoice top-level, mapped to 0 or total approximation
                // The frontend PppPrintClient mostly calculates these from Pelanggan profile for display
                biayaInstalasi: 0,
                biayaSewaPerangkat: 0,
                biayaLainnya: 0,
                total: Number(invoice.totalAmount),
                status: status,
                jatuhTempo: invoice.dueDate.toISOString(),
                tanggalBayar: invoice.paidAt ? invoice.paidAt.toISOString() : null,
                metodePembayaran: paymentMethod,
                createdAt: invoice.createdAt.toISOString()
            }
        })

        return NextResponse.json(tagihans)

    } catch (error) {
        console.error('Error fetching tagihan adapter:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
