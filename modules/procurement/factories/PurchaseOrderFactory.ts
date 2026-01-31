/**
 * PurchaseOrderFactory
 *
 * Factory pattern for creating Purchase Orders with different configurations.
 */

import type { PurchaseOrderStatus } from '@prisma/client'

export interface CreatePurchaseOrderInput {
    poNumber: string
    supplierId?: string
    status: PurchaseOrderStatus
    totalAmount: number
    ppnRate: number
    ppnAmount: number
    grandTotal: number
    expectedDate?: Date
    notes?: string
    createdBy: string
}

export interface PurchaseOrderItemInput {
    barangId: string
    quantity: number
    unitPrice: number
    totalPrice: number
}

export class PurchaseOrderFactory {
    /**
     * Create standard purchase order
     */
    static createStandardPO(dto: {
        supplierId: string
        items: { barangId: string; quantity: number; unitPrice: number }[]
        expectedDate?: Date
        notes?: string
        createdBy: string
    }): { po: CreatePurchaseOrderInput; items: PurchaseOrderItemInput[] } {
        const items = dto.items.map(item => ({
            barangId: item.barangId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
        }))

        const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0)

        return {
            po: {
                poNumber: this.generatePONumber(),
                supplierId: dto.supplierId,
                status: 'DRAFT',
                totalAmount,
                ppnRate: 0,
                ppnAmount: 0,
                grandTotal: totalAmount,
                expectedDate: dto.expectedDate,
                notes: dto.notes,
                createdBy: dto.createdBy,
            },
            items,
        }
    }

    /**
     * Create purchase order with PPN (tax)
     */
    static createPOWithPPN(dto: {
        supplierId: string
        items: { barangId: string; quantity: number; unitPrice: number }[]
        ppnRate: number
        expectedDate?: Date
        notes?: string
        createdBy: string
    }): { po: CreatePurchaseOrderInput; items: PurchaseOrderItemInput[] } {
        const items = dto.items.map(item => ({
            barangId: item.barangId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
        }))

        const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0)
        const ppnAmount = (totalAmount * dto.ppnRate) / 100
        const grandTotal = totalAmount + ppnAmount

        return {
            po: {
                poNumber: this.generatePONumber(),
                supplierId: dto.supplierId,
                status: 'DRAFT',
                totalAmount,
                ppnRate: dto.ppnRate,
                ppnAmount,
                grandTotal,
                expectedDate: dto.expectedDate,
                notes: dto.notes,
                createdBy: dto.createdBy,
            },
            items,
        }
    }

    /**
     * Create urgent purchase order (auto-submitted)
     */
    static createUrgentPO(dto: {
        supplierId: string
        items: { barangId: string; quantity: number; unitPrice: number }[]
        reason: string
        createdBy: string
    }): { po: CreatePurchaseOrderInput; items: PurchaseOrderItemInput[] } {
        const items = dto.items.map(item => ({
            barangId: item.barangId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
        }))

        const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0)

        return {
            po: {
                poNumber: this.generatePONumber('URG'),
                supplierId: dto.supplierId,
                status: 'ORDERED', // Auto-submitted
                totalAmount,
                ppnRate: 0,
                ppnAmount: 0,
                grandTotal: totalAmount,
                expectedDate: new Date(), // Expect ASAP
                notes: `[URGENT] ${dto.reason}`,
                createdBy: dto.createdBy,
            },
            items,
        }
    }

    /**
     * Create restock purchase order from inventory alert
     */
    static createRestockPO(dto: {
        supplierId: string
        restockItems: { barangId: string; currentStock: number; minStock: number; unitPrice: number }[]
        createdBy: string
    }): { po: CreatePurchaseOrderInput; items: PurchaseOrderItemInput[] } {
        // Calculate restock quantity: bring to 2x minStock
        const items = dto.restockItems.map(item => {
            const targetStock = item.minStock * 2
            const quantity = Math.max(0, targetStock - item.currentStock)
            return {
                barangId: item.barangId,
                quantity,
                unitPrice: item.unitPrice,
                totalPrice: quantity * item.unitPrice,
            }
        }).filter(item => item.quantity > 0)

        const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0)

        return {
            po: {
                poNumber: this.generatePONumber('RST'),
                supplierId: dto.supplierId,
                status: 'DRAFT',
                totalAmount,
                ppnRate: 0,
                ppnAmount: 0,
                grandTotal: totalAmount,
                notes: 'Auto-generated restock order',
                createdBy: dto.createdBy,
            },
            items,
        }
    }

    /**
     * Generate unique PO number
     */
    static generatePONumber(prefix: string = 'PO'): string {
        const now = new Date()
        const year = now.getFullYear().toString().slice(-2)
        const month = (now.getMonth() + 1).toString().padStart(2, '0')
        const day = now.getDate().toString().padStart(2, '0')
        const random = Math.random().toString(36).substring(2, 6).toUpperCase()
        return `${prefix}${year}${month}${day}-${random}`
    }
}
