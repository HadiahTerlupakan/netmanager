import { Prisma as PrismaBilling } from '@/prisma/generated/billing';
/**
 * InvoiceFactory
 *
 * Factory pattern for creating Invoice with different configurations.
 */



import { prismaBilling } from '@/lib/prisma-billing';
import { randomUUID } from 'crypto'

export class InvoiceFactory {
    /**
     * Create input for monthly subscription invoice
     */
    static async createMonthlyInvoice(dto: {
        pelangganId: string
        periodMonth: number // 1-12
        periodYear: number
        packagePrice: number
        packageName: string
        additionalFees?: {
            description: string
            amount: number
        }[]
        taxRate?: number // e.g., 0.11 for 11% PPN
        discountAmount?: number
        siteId?: string
    }): Promise<PrismaBilling.InvoiceUncheckedCreateInput> {
        const invoiceNumber = await this.generateInvoiceNumber()

        // Due date: 10th of the billing month
        const dueDate = new Date(dto.periodYear, dto.periodMonth - 1, 10)

        // Calculate amounts
        let subtotal = dto.packagePrice
        const items: PrismaBilling.InvoiceItemCreateManyInvoiceInput[] = [{
            id: randomUUID(),
            description: `Langganan ${dto.packageName} - ${this.getMonthName(dto.periodMonth)} ${dto.periodYear}`,
            quantity: 1,
            unitPrice: dto.packagePrice,
            totalPrice: dto.packagePrice,
            itemType: 'MONTHLY_FEE',
        }]

        // Add additional fees
        if (dto.additionalFees) {
            for (const fee of dto.additionalFees) {
                subtotal += fee.amount
                items.push({
                    id: randomUUID(),
                    description: fee.description,
                    quantity: 1,
                    unitPrice: fee.amount,
                    totalPrice: fee.amount,
                    itemType: 'OTHER',
                })
            }
        }

        // Calculate tax and discount
        const discountAmount = dto.discountAmount ?? 0
        const taxableAmount = subtotal - discountAmount
        const taxAmount = dto.taxRate ? Math.round(taxableAmount * dto.taxRate) : 0
        const totalAmount = taxableAmount + taxAmount

        return {
            id: randomUUID(),
            invoiceNumber,
            pelangganId: dto.pelangganId,
            dueDate,
            subtotal,
            taxAmount,
            discountAmount,
            totalAmount,
            paidAmount: 0,
            status: 'DRAFT',
            notes: `Periode: ${this.getMonthName(dto.periodMonth)} ${dto.periodYear}`,
            updatedAt: new Date(),
            ...(dto.siteId && { siteId: dto.siteId }),
            invoiceItem: {
                createMany: {
                    data: items,
                }
            },
        }
    }

    /**
     * Create input for one-time invoice (installation, equipment, etc.)
     */
    static async createOneTimeInvoice(dto: {
        pelangganId: string
        dueDate: Date
        items: {
            description: string
            quantity: number
            unitPrice: number
            itemType?: string
        }[]
        taxRate?: number
        discountAmount?: number
        notes?: string
        siteId?: string
    }): Promise<PrismaBilling.InvoiceUncheckedCreateInput> {
        const invoiceNumber = await this.generateInvoiceNumber()

        // Calculate amounts
        let subtotal = 0
        const invoiceItems: PrismaBilling.InvoiceItemCreateManyInvoiceInput[] = dto.items.map((item) => {
            const totalPrice = item.quantity * item.unitPrice
            subtotal += totalPrice
            return {
                id: randomUUID(),
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice,
                itemType: (item.itemType ?? 'SERVICE') as 'SERVICE' | 'PRODUCT' | 'SETUP_FEE' | 'MONTHLY_FEE' | 'ONE_TIME_FEE' | 'OTHER',
            }
        })

        const discountAmount = dto.discountAmount ?? 0
        const taxableAmount = subtotal - discountAmount
        const taxAmount = dto.taxRate ? Math.round(taxableAmount * dto.taxRate) : 0
        const totalAmount = taxableAmount + taxAmount

        return {
            id: randomUUID(),
            invoiceNumber,
            pelangganId: dto.pelangganId,
            dueDate: dto.dueDate,
            subtotal,
            taxAmount,
            discountAmount,
            totalAmount,
            paidAmount: 0,
            status: 'DRAFT',
            notes: dto.notes,
            updatedAt: new Date(),
            ...(dto.siteId && { siteId: dto.siteId }),
            invoiceItem: {
                createMany: {
                    data: invoiceItems,
                }
            },
        }
    }

    /**
     * Create input for prorated invoice (mid-month activation)
     */
    static async createProratedInvoice(dto: {
        pelangganId: string
        activationDate: Date
        packagePrice: number
        packageName: string
        taxRate?: number
        siteId?: string
    }): Promise<PrismaBilling.InvoiceUncheckedCreateInput> {
        const invoiceNumber = await this.generateInvoiceNumber()

        // Calculate prorated amount
        const activationDay = dto.activationDate.getDate()
        const daysInMonth = new Date(
            dto.activationDate.getFullYear(),
            dto.activationDate.getMonth() + 1,
            0
        ).getDate()
        const remainingDays = daysInMonth - activationDay + 1
        const proratedAmount = Math.round((dto.packagePrice / daysInMonth) * remainingDays)

        // Due date: 7 days from activation
        const dueDate = new Date(dto.activationDate)
        dueDate.setDate(dueDate.getDate() + 7)

        const taxAmount = dto.taxRate ? Math.round(proratedAmount * dto.taxRate) : 0
        const totalAmount = proratedAmount + taxAmount

        return {
            id: randomUUID(),
            invoiceNumber,
            pelangganId: dto.pelangganId,
            dueDate,
            subtotal: proratedAmount,
            taxAmount,
            discountAmount: 0,
            totalAmount,
            paidAmount: 0,
            status: 'DRAFT',
            notes: `Prorata ${remainingDays} hari`,
            updatedAt: new Date(),
            ...(dto.siteId && { siteId: dto.siteId }),
            invoiceItem: {
                createMany: {
                    data: [{
                        id: randomUUID(),
                        description: `Langganan ${dto.packageName} (Prorata ${remainingDays} hari)`,
                        quantity: 1,
                        unitPrice: proratedAmount,
                        totalPrice: proratedAmount,
                        itemType: 'MONTHLY_FEE',
                    }]
                }
            },
        }
    }

    /**
     * Generate invoice number: INV-YYYYMM-XXXXX
     */
    static async generateInvoiceNumber(): Promise<string> {
        const now = new Date()
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

        const count = await prismaBilling.invoice.count({
            where: {
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                }
            }
        })

        return `INV-${yearMonth}-${String(count + 1).padStart(5, '0')}`
    }

    /**
     * Get Indonesian month name
     */
    private static getMonthName(month: number): string {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]
        return months[month - 1] ?? ''
    }
}
