import { Prisma as PrismaBilling } from '@/prisma/generated/billing';
import { prisma } from '@/lib/prisma'
import { prismaBilling } from '@/lib/prisma-billing';
import {  Prisma } from '@prisma/client';
import { InvoiceStatus  } from '@/prisma/generated/billing';

/**
 * Type for invoice with its relations used in this repository
 */
type InvoiceWithRelations = PrismaBilling.InvoiceGetPayload<{
    include: {
        invoiceItem: true,
        payment: true,
    }
}>

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

        const where: PrismaBilling.InvoiceWhereInput = { pelangganId }
        if (status) {
            where.status = status as InvoiceStatus
        }

        const [invoices, total] = await Promise.all([
            prismaBilling.invoice.findMany({
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
            prismaBilling.invoice.count({ where }),
        ])

        return { invoices, total }
    }

    /**
     * Format invoices for API response
     */
    formatInvoicesForResponse(invoices: InvoiceWithRelations[]) {
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
            items: inv.invoiceItem.map((item) => ({
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
