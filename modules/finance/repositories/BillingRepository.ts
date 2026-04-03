import { prismaBilling } from '@/lib/prisma-billing'
import type { PrismaClient, Payment, Invoice, PaymentGatewayConfig, InvoiceStatus, Prisma, GatewayPaymentStatus } from '@prisma/client-billing'

export class BillingRepository {
    constructor(private client: PrismaClient = prismaBilling) {}

    async findPaymentsByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
        return this.client.payment.findMany({
            where: { paymentDate: { gte: startDate, lte: endDate } }
        })
    }

    async findPaymentsByPelangganId(pelangganId: string, options?: { page?: number; limit?: number }): Promise<{ payments: Payment[]; total: number }> {
        const where: Prisma.PaymentWhereInput = { pelangganId }
        const skip = options?.page && options?.limit ? (options.page - 1) * options.limit : undefined
        const take = options?.limit
        const [payments, total] = await Promise.all([
            this.client.payment.findMany({ where, orderBy: { paymentDate: 'desc' }, skip, take }),
            this.client.payment.count({ where })
        ])
        return { payments, total }
    }

    async findInvoicesByDateRange(startDate: Date, endDate: Date): Promise<Invoice[]> {
        return this.client.invoice.findMany({
            where: { dueDate: { gte: startDate, lte: endDate } }
        })
    }

    async findInvoicesByPelangganIds(pelangganIds: string[], dueDateRange: { gte: Date; lte: Date }): Promise<Pick<Invoice, 'pelangganId'>[]> {
        return this.client.invoice.findMany({
            where: { pelangganId: { in: pelangganIds }, dueDate: dueDateRange },
            select: { pelangganId: true }
        })
    }

    async findInvoicesByPelangganId(pelangganId: string, dueDateRange: { gte: Date; lte: Date }): Promise<Invoice[]> {
        return this.client.invoice.findMany({
            where: { pelangganId, dueDate: dueDateRange }
        })
    }

    async findInvoiceById(id: string): Promise<(Invoice & { payment: Payment[] }) | null> {
        return this.client.invoice.findUnique({
            where: { id },
            include: { payment: true }
        })
    }

    async findInvoicesByStatus(status: InvoiceStatus, beforeDate: Date): Promise<Invoice[]> {
        return this.client.invoice.findMany({
            where: { status, dueDate: { lt: beforeDate } }
        })
    }

    async findUnpaidInvoices(where: Prisma.InvoiceWhereInput, select?: Prisma.InvoiceSelect): Promise<Invoice[]> {
        return this.client.invoice.findMany({ where, select })
    }

    async countInvoices(where: Prisma.InvoiceWhereInput): Promise<number> {
        return this.client.invoice.count({ where })
    }

    async updateInvoice(id: string, data: Prisma.InvoiceUpdateInput): Promise<Invoice> {
        return this.client.invoice.update({ where: { id }, data })
    }

    async createInvoice(data: Prisma.InvoiceCreateInput): Promise<Invoice> {
        return this.client.invoice.create({ data })
    }

    async createPayment(data: Prisma.PaymentCreateInput): Promise<Payment> {
        return this.client.payment.create({ data })
    }

    async updatePaymentsForInvoice(invoiceId: string, newStatus: GatewayPaymentStatus): Promise<void> {
        await this.client.payment.updateMany({
            where: { invoiceId, gatewayStatus: 'PAID' },
            data: { gatewayStatus: newStatus }
        })
    }

    async findEnabledPaymentGateways(): Promise<PaymentGatewayConfig[]> {
        return this.client.paymentGatewayConfig.findMany({
            where: { isEnabled: true },
            orderBy: { priority: 'desc' }
        })
    }

    async findPaymentGatewayConfig(providerType: string, tenantId?: string): Promise<PaymentGatewayConfig | null> {
        return this.client.paymentGatewayConfig.findFirst({
            where: {
                provider: providerType,
                ...(tenantId ? { tenantId } : {})
            }
        })
    }

    async transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.client.$transaction(fn as any) as Promise<T>
    }

    async createInvoiceWithItems(data: Prisma.InvoiceCreateInput): Promise<Invoice> {
        return this.client.invoice.create({ data })
    }

    async countUnpaidByPelangganId(pelangganId: string): Promise<number> {
        return this.client.invoice.count({
            where: {
                pelangganId,
                status: { notIn: ['PAID', 'CANCELLED'] }
            }
        })
    }
}
