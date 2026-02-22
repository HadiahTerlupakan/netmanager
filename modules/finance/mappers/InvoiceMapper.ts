/**
 * InvoiceMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Invoice, InvoiceItem, Payment } from '@/prisma/generated/billing'
import type {
    InvoiceListItemDTO,
    InvoiceDetailDTO,
    InvoicePortalDTO,
    InvoiceItemDTO,
    InvoicePaymentDTO,
    BillingSummaryDTO,
} from '../dto/InvoiceDTO'

// Extended type with relations
type InvoiceWithRelations = Invoice & {
    pelanggan?: {
        id: string
        idPelanggan: string
        nama: string
        alamat: string | null
        noTelp: string | null
        email: string | null
    } | null
    items?: InvoiceItem[]
    payments?: (Payment & {
        verifiedAt?: Date | null
    })[]
}

export class InvoiceMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: InvoiceWithRelations): InvoiceListItemDTO {
        const totalAmount = this.toNumber(entity.totalAmount)
        const paidAmount = this.toNumber(entity.paidAmount)

        return {
            id: entity.id,
            invoiceNumber: entity.invoiceNumber,
            dueDate: entity.dueDate.toISOString(),
            totalAmount,
            paidAmount,
            remainingAmount: totalAmount - paidAmount,
            status: entity.status,
            createdAt: entity.createdAt.toISOString(),
            pelangganName: entity.pelanggan?.nama ?? null,
            pelangganId: entity.pelangganId,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: InvoiceWithRelations[]): InvoiceListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: InvoiceWithRelations): InvoiceDetailDTO {
        const totalAmount = this.toNumber(entity.totalAmount)
        const paidAmount = this.toNumber(entity.paidAmount)
        const taxAmount = this.toNumber(entity.taxAmount)
        const discountAmount = this.toNumber(entity.discountAmount)
        const subtotal = this.toNumber(entity.subtotal)

        return {
            id: entity.id,
            invoiceNumber: entity.invoiceNumber,
            issueDate: entity.issueDate?.toISOString() ?? entity.createdAt.toISOString(),
            dueDate: entity.dueDate.toISOString(),
            subtotal,
            taxAmount,
            discountAmount,
            totalAmount,
            paidAmount,
            remainingAmount: totalAmount - paidAmount,
            status: entity.status,
            pelanggan: entity.pelanggan ? {
                id: entity.pelanggan.id,
                idPelanggan: entity.pelanggan.idPelanggan,
                nama: entity.pelanggan.nama,
                alamat: entity.pelanggan.alamat,
                noTelp: entity.pelanggan.noTelp,
                email: entity.pelanggan.email,
            } : null,
            items: this.mapItems(entity.items ?? []),
            payments: this.mapPayments(entity.payments ?? []),
            notes: entity.notes,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            sentAt: entity.sentAt?.toISOString() ?? null,
            paidAt: entity.paidAt?.toISOString() ?? null,
        }
    }

    /**
     * Map to portal DTO (for customer)
     */
    static toPortal(entity: InvoiceWithRelations): InvoicePortalDTO {
        const totalAmount = this.toNumber(entity.totalAmount)
        const paidAmount = this.toNumber(entity.paidAmount)
        const isOverdue = entity.status === 'OVERDUE' ||
            (entity.status === 'SENT' && new Date() > entity.dueDate)

        return {
            id: entity.id,
            invoiceNumber: entity.invoiceNumber,
            dueDate: entity.dueDate.toISOString(),
            totalAmount,
            paidAmount,
            remainingAmount: totalAmount - paidAmount,
            status: entity.status,
            isOverdue,
        }
    }

    /**
     * Map array to portal DTOs
     */
    static toPortalList(entities: InvoiceWithRelations[]): InvoicePortalDTO[] {
        return entities.map(entity => this.toPortal(entity))
    }

    /**
     * Create billing summary from aggregated data
     */
    static toBillingSummary(data: {
        unpaidInvoices: { totalAmount: number | { toNumber(): number }; status: string }[]
    }): BillingSummaryDTO {
        let totalUnpaid = 0
        let totalOverdue = 0
        let overdueCount = 0

        for (const inv of data.unpaidInvoices) {
            const amount = this.toNumber(inv.totalAmount)
            totalUnpaid += amount

            if (inv.status === 'OVERDUE') {
                totalOverdue += amount
                overdueCount++
            }
        }

        return {
            totalUnpaid,
            totalOverdue,
            upcomingDue: totalUnpaid - totalOverdue,
            invoiceCount: data.unpaidInvoices.length,
            overdueCount,
        }
    }

    // ==================== Private Helpers ====================

    private static toNumber(value: number | bigint | { toNumber(): number } | null | undefined): number {
        if (value === null || value === undefined) return 0
        if (typeof value === 'number') return value
        if (typeof value === 'bigint') return Number(value)
        if (typeof value.toNumber === 'function') return value.toNumber()
        return 0
    }

    private static mapItems(items: InvoiceItem[]): InvoiceItemDTO[] {
        return items.map(item => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: this.toNumber(item.unitPrice),
            amount: this.toNumber(item.totalPrice),
            itemType: item.itemType,
        }))
    }

    private static mapPayments(payments: (Payment & { verifiedAt?: Date | null })[]): InvoicePaymentDTO[] {
        return payments.map(pay => ({
            id: pay.id,
            amount: this.toNumber(pay.amount),
            paymentDate: pay.paymentDate.toISOString(),
            paymentMethod: pay.paymentMethod,
            reference: pay.reference,
            verified: !!pay.verifiedAt,
        }))
    }
}
