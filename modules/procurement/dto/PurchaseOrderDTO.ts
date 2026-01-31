/**
 * PurchaseOrder DTOs (Data Transfer Objects)
 */

import type { PurchaseOrderStatus, PaymentStatus } from '@prisma/client'

// ==================== Response DTOs ====================

/**
 * DTO for PO list views
 */
export interface PurchaseOrderListItemDTO {
    id: string
    poNumber: string
    status: PurchaseOrderStatus
    paymentStatus: PaymentStatus
    supplierName: string | null
    totalAmount: number
    grandTotal: number
    expectedDate: string | null
    createdAt: string
    creatorName: string | null
}

/**
 * DTO for PO detail views
 */
export interface PurchaseOrderDetailDTO {
    id: string
    poNumber: string
    status: PurchaseOrderStatus
    paymentStatus: PaymentStatus
    totalAmount: number
    ppnRate: number
    ppnAmount: number
    grandTotal: number
    issuedAt: string | null
    expectedDate: string | null
    notes: string | null
    createdAt: string
    updatedAt: string
    supplier: {
        id: string
        code: string
        name: string
        contact: string | null
    } | null
    creator: {
        id: string
        name: string | null
    }
    processedBy: {
        id: string
        name: string | null
    } | null
    receivedBy: {
        id: string
        name: string | null
    } | null
    items: PurchaseOrderItemDTO[]
}

/**
 * DTO for PO items
 */
export interface PurchaseOrderItemDTO {
    id: string
    barangId: string
    barangName: string
    barangCode: string
    quantity: number
    unitPrice: number
    totalPrice: number
}

/**
 * DTO for supplier list
 */
export interface SupplierListItemDTO {
    id: string
    code: string
    name: string
    contact: string | null
    email: string | null
    phone: string | null
}

/**
 * DTO for supplier detail
 */
export interface SupplierDetailDTO {
    id: string
    code: string
    name: string
    address: string | null
    contact: string | null
    email: string | null
    phone: string | null
    createdAt: string
    updatedAt: string
}

/**
 * DTO for supplier option
 */
export interface SupplierOptionDTO {
    id: string
    code: string
    name: string
}

// ==================== Request DTOs ====================

/**
 * DTO for creating PO
 */
export interface CreatePurchaseOrderDTO {
    supplierId?: string
    expectedDate?: string
    notes?: string
    ppnRate?: number
    items: {
        barangId: string
        quantity: number
        unitPrice: number
    }[]
}

/**
 * DTO for updating PO
 */
export interface UpdatePurchaseOrderDTO {
    supplierId?: string
    expectedDate?: string
    notes?: string
    ppnRate?: number
    status?: PurchaseOrderStatus
}
