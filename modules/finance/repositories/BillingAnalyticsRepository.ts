import { prisma } from '@/lib/prisma'
import type { Invoice, Payment } from '@prisma/client'

export type InvoiceWithPayments = Invoice & { payment: Payment[]; pelanggan: { id: string; nama: string } | null }

/**
 * Repository for billing analytics data access
 */
export class BillingAnalyticsRepository {
    /**
     * Get invoices with payments for a date range
     */
    async getInvoicesWithPayments(dateStart: Date, dateEnd: Date): Promise<InvoiceWithPayments[]> {
        return prisma.invoice.findMany({
            where: {
                createdAt: {
                    gte: dateStart,
                    lte: dateEnd,
                },
            },
            include: {
                payment: true,
                pelanggan: {
                    select: {
                        id: true,
                        nama: true,
                    },
                },
            },
        }) as Promise<InvoiceWithPayments[]>
    }

    /**
     * Get all payments for a date range
     */
    async getPayments(dateStart: Date, dateEnd: Date) {
        return prisma.payment.findMany({
            where: {
                paymentDate: {
                    gte: dateStart,
                    lte: dateEnd,
                },
            },
        })
    }

    /**
     * Get invoices for a specific month
     */
    async getInvoicesForMonth(monthStart: Date, monthEnd: Date) {
        return prisma.invoice.findMany({
            where: {
                createdAt: {
                    gte: monthStart,
                    lt: monthEnd,
                },
            },
        })
    }

    /**
     * Get top customers by payment amount (optimized with groupBy)
     */
    async getTopCustomersByPayment(dateStart: Date, dateEnd: Date, limit: number = 10) {
        const customerPayments = await prisma.payment.groupBy({
            by: ['pelangganId'],
            where: {
                paymentDate: {
                    gte: dateStart,
                    lte: dateEnd,
                },
            },
            _sum: {
                amount: true,
            },
            _count: {
                id: true,
            },
            orderBy: {
                _sum: {
                    amount: 'desc',
                },
            },
            take: limit,
        })

        // Batch fetch customer names
        const customerIds = customerPayments.map(cp => cp.pelangganId)
        const customers = await prisma.pelanggan.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, nama: true },
        })

        const customerMap = new Map(customers.map(c => [c.id, c.nama]))

        return customerPayments.map(cp => ({
            id: cp.pelangganId,
            name: customerMap.get(cp.pelangganId) || 'Unknown',
            totalPaid: Number(cp._sum.amount) / 100,
            invoiceCount: cp._count.id,
        }))
    }
}
