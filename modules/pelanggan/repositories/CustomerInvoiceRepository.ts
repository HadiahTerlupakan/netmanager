import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * Repository for customer invoice operations
 * Handles invoice queries with items and payment history
 */
export class CustomerInvoiceRepository {
    /**
     * Get invoices with pagination and optional status filter
     * Includes invoice items and last payment
     */
    async findAllForCustomer(
        pelangganId: string, 
        options: {
            page: number
            limit: number
            status?: string
        }
    ) {
        const { page, limit, status } = options
        const skip = (page - 1) * limit

        const where: Prisma.InvoiceWhereInput = { pelangganId }
        if (status) {
            where.status = status as any
        }

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                orderBy: { issueDate: 'desc' },
                skip,
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

        return { invoices, total }
    }

    /**
     * Format invoices for API response
     */
    formatInvoicesForResponse(invoices: any[]) {
        return invoices.map((inv) => ({
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
            lastPayment: inv.payment[0] ? {
                amount: Number(inv.payment[0].amount),
                date: inv.payment[0].paymentDate,
                method: inv.payment[0].paymentMethod,
            } : null,
        }))
    }
}
