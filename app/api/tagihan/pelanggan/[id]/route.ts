import { prisma } from '@/lib/prisma'
import { apiSuccess, createHandler } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id: pelangganId } = ctx.params

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
        else if (invoice.status === 'CANCELLED') status = 'LUNAS' 

        const date = new Date(invoice.createdAt)
        const paymentMethod = invoice.payment.length > 0 ? invoice.payment[0]?.paymentMethod : null

        return {
            id: invoice.id,
            noTagihan: invoice.invoiceNumber,
            periodeBulan: date.getMonth() + 1,
            periodeTahun: date.getFullYear(),
            subtotal: Number(invoice.subtotal),
            diskon: Number(invoice.discountAmount),
            ppn: Number(invoice.taxAmount),
            // Old fields not present in Invoice top-level, mapped to 0 or total approximation
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

    return apiSuccess(tagihans)
})
