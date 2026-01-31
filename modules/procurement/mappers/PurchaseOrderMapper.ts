/**
 * PurchaseOrderMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { PurchaseOrder, Supplier, PurchaseOrderItem } from '@prisma/client'
import type {
    PurchaseOrderListItemDTO,
    PurchaseOrderDetailDTO,
    PurchaseOrderItemDTO,
    SupplierListItemDTO,
    SupplierDetailDTO,
    SupplierOptionDTO,
} from '../dto/PurchaseOrderDTO'

// Extended types
type PurchaseOrderWithRelations = PurchaseOrder & {
    supplier?: {
        id: string
        code: string
        name: string
        contact: string | null
    } | null
    creator?: {
        id: string
        name: string | null
    }
    processedBy?: {
        id: string
        name: string | null
    } | null
    receivedBy?: {
        id: string
        name: string | null
    } | null
    items?: (PurchaseOrderItem & {
        barang?: {
            id: string
            name: string
            code: string
        }
    })[]
}

export class PurchaseOrderMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: PurchaseOrderWithRelations): PurchaseOrderListItemDTO {
        return {
            id: entity.id,
            poNumber: entity.poNumber,
            status: entity.status,
            paymentStatus: entity.paymentStatus,
            supplierName: entity.supplier?.name ?? null,
            totalAmount: entity.totalAmount,
            grandTotal: entity.grandTotal,
            expectedDate: entity.expectedDate?.toISOString() ?? null,
            createdAt: entity.createdAt.toISOString(),
            creatorName: entity.creator?.name ?? null,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: PurchaseOrderWithRelations[]): PurchaseOrderListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: PurchaseOrderWithRelations): PurchaseOrderDetailDTO {
        return {
            id: entity.id,
            poNumber: entity.poNumber,
            status: entity.status,
            paymentStatus: entity.paymentStatus,
            totalAmount: entity.totalAmount,
            ppnRate: entity.ppnRate,
            ppnAmount: entity.ppnAmount,
            grandTotal: entity.grandTotal,
            issuedAt: entity.issuedAt?.toISOString() ?? null,
            expectedDate: entity.expectedDate?.toISOString() ?? null,
            notes: entity.notes,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            supplier: entity.supplier ? {
                id: entity.supplier.id,
                code: entity.supplier.code,
                name: entity.supplier.name,
                contact: entity.supplier.contact,
            } : null,
            creator: {
                id: entity.creator?.id ?? entity.createdBy,
                name: entity.creator?.name ?? null,
            },
            processedBy: entity.processedBy ? {
                id: entity.processedBy.id,
                name: entity.processedBy.name,
            } : null,
            receivedBy: entity.receivedBy ? {
                id: entity.receivedBy.id,
                name: entity.receivedBy.name,
            } : null,
            items: this.mapItems(entity.items ?? []),
        }
    }

    // ==================== Supplier Mappers ====================

    /**
     * Map supplier to list item DTO
     */
    static supplierToListItem(entity: Supplier): SupplierListItemDTO {
        return {
            id: entity.id,
            code: entity.code,
            name: entity.name,
            contact: entity.contact,
            email: entity.email,
            phone: entity.phone,
        }
    }

    /**
     * Map suppliers to list items
     */
    static suppliersToListItems(entities: Supplier[]): SupplierListItemDTO[] {
        return entities.map(entity => this.supplierToListItem(entity))
    }

    /**
     * Map supplier to detail DTO
     */
    static supplierToDetail(entity: Supplier): SupplierDetailDTO {
        return {
            id: entity.id,
            code: entity.code,
            name: entity.name,
            address: entity.address,
            contact: entity.contact,
            email: entity.email,
            phone: entity.phone,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
        }
    }

    /**
     * Map supplier to option DTO
     */
    static supplierToOption(entity: Supplier): SupplierOptionDTO {
        return {
            id: entity.id,
            code: entity.code,
            name: entity.name,
        }
    }

    /**
     * Map suppliers to options
     */
    static suppliersToOptions(entities: Supplier[]): SupplierOptionDTO[] {
        return entities.map(entity => this.supplierToOption(entity))
    }

    // ==================== Private Helpers ====================

    private static mapItems(items: (PurchaseOrderItem & {
        barang?: {
            id: string
            name: string
            code: string
        }
    })[]): PurchaseOrderItemDTO[] {
        return items.map(item => ({
            id: item.id,
            barangId: item.barangId,
            barangName: item.barang?.name ?? '',
            barangCode: item.barang?.code ?? '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
        }))
    }
}
