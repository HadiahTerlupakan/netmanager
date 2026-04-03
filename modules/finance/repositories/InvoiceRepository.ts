import { prismaBilling } from '@/lib/prisma-billing'
import type { Invoice, Payment, InvoiceItem, Prisma } from '@prisma/client-billing'

export type InvoiceWithPayment = Invoice & { payment: Payment[] }
export type InvoiceWithItems = Invoice & { invoiceItem: InvoiceItem[] }

export class InvoiceRepository {
    async findUnique(id: string) {
        return prismaBilling.invoice.findUnique({
            where: { id },
            include: { payment: true }
        })
    }

    async findMany(where: Prisma.InvoiceWhereInput, select?: Prisma.InvoiceSelect) {
        return prismaBilling.invoice.findMany({
            where,
            ...(select ? { select } : {})
        })
    }

    async count(where: Prisma.InvoiceWhereInput) {
        return prismaBilling.invoice.count({ where })
    }

    async update(id: string, data: Prisma.InvoiceUpdateInput) {
        return prismaBilling.invoice.update({
            where: { id },
            data
        })
    }

    async create(data: Prisma.InvoiceCreateInput) {
        return prismaBilling.invoice.create({ data })
    }

    async createPayment(data: Prisma.PaymentCreateInput) {
        return prismaBilling.payment.create({ data })
    }

    async findManyForDateRange(dueDateStart: Date, dueDateEnd: Date, pelangganIds?: string[]) {
        const where: Prisma.InvoiceWhereInput = {
            dueDate: { gte: dueDateStart, lte: dueDateEnd }
        }
        if (pelangganIds) {
            where.pelangganId = { in: pelangganIds }
        }
        return prismaBilling.invoice.findMany({
            where,
            select: { pelangganId: true }
        })
    }

    async findManyForExactDueDate(pelangganId: string, dueDateStart: Date, dueDateEnd: Date) {
        return prismaBilling.invoice.findMany({
            where: {
                pelangganId,
                dueDate: { gte: dueDateStart, lte: dueDateEnd }
            }
        })
    }

    async findManyForDateRangeWithPelangganIds(dueDateStart: Date, dueDateEnd: Date, pelangganIds: string[]) {
        return prismaBilling.invoice.findMany({
            where: {
                pelangganId: { in: pelangganIds },
                dueDate: { gte: dueDateStart, lte: dueDateEnd }
            },
            select: { pelangganId: true }
        })
    }

    async findUnpaidInvoices(where: Prisma.InvoiceWhereInput, select?: Prisma.InvoiceSelect) {
        return prismaBilling.invoice.findMany({
            where,
            ...(select ? { select } : {})
        })
    }

    async findOverdueInvoices(beforeDate: Date) {
        return prismaBilling.invoice.findMany({
            where: {
                status: 'OVERDUE',
                dueDate: { lt: beforeDate }
            }
        })
    }

    async voidInvoiceTransaction(invoiceId: string, reason: string, invoiceNotes: string | null) {
        return prismaBilling.$transaction(async (tx) => {
            await tx.payment.updateMany({
                where: { invoiceId, gatewayStatus: 'PAID' },
                data: { gatewayStatus: 'REFUNDED' }
            })
            await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'CANCELLED',
                    paidAmount: 0,
                    notes: invoiceNotes
                        ? `${invoiceNotes}\n[VOID] Reason: ${reason}`
                        : `[VOID] Reason: ${reason}`
                }
            })
        })
    }

    async countUnpaidByPelangganId(pelangganId: string) {
        return prismaBilling.invoice.count({
            where: {
                pelangganId,
                status: { notIn: ['PAID', 'CANCELLED'] }
            }
        })
    }
}
