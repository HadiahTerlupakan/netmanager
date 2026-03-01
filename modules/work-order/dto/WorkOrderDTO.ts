/**
 * WorkOrder DTOs (Data Transfer Objects)
 *
 * DTOs define the shape of data for API responses and requests.
 * They decouple the Prisma entity from the external API contract.
 */

import type { WorkOrderStatus, WorkOrderPriority, WorkOrderType } from '@prisma/client'

// ==================== Response DTOs ====================

/**
 * Minimal DTO for list views
 */
export interface WorkOrderListItemDTO {
    id: string
    workOrderNumber: string
    title: string
    type: WorkOrderType
    status: WorkOrderStatus
    priority: WorkOrderPriority
    scheduledDate: string | null
    createdAt: string
    // Flattened relations
    pelangganName: string | null
    pelangganId: string | null
    departmentName: string | null
    siteName: string | null
    assignedToName: string | null
    assignedMitraName: string | null
}

/**
 * Full DTO for detail views
 */
export interface WorkOrderDetailDTO {
    id: string
    workOrderNumber: string
    title: string
    description: string
    type: WorkOrderType
    status: WorkOrderStatus
    priority: WorkOrderPriority
    scheduledDate: string | null
    completedAt: string | null
    resolutionNotes: string | null
    createdAt: string
    updatedAt: string
    // Related entities
    pelanggan: {
        id: string
        idPelanggan: string
        nama: string
        noTelp: string | null
    } | null
    department: {
        id: string
        name: string
    } | null
    site: {
        id: string
        name: string
    } | null
    assignedTo: {
        id: string
        name: string | null
        email: string
    } | null
    assignedMitra: {
        id: string
        name: string
    } | null
    createdBy: {
        id: string
        name: string | null
    } | null
    // Nested collections
    tasks: WorkOrderTaskDTO[]
    materials: WorkOrderMaterialDTO[]
    updates: WorkOrderUpdateDTO[]
}

export interface WorkOrderTaskDTO {
    id: string
    title: string
    description: string | null
    status: string
    order: number
    completedAt: string | null
}

export interface WorkOrderMaterialDTO {
    id: string
    barangName: string
    barangCode: string | null
    quantity: number
    satuan: string | null
    notes: string | null
}

export interface WorkOrderUpdateDTO {
    id: string
    message: string
    createdAt: string
    createdBy: {
        id: string
        name: string | null
    } | null
}

/**
 * DTO for mobile app (simplified)
 */
export interface WorkOrderMobileDTO {
    id: string
    workOrderNumber: string
    title: string
    type: WorkOrderType
    status: WorkOrderStatus
    priority: WorkOrderPriority
    scheduledDate: string | null
    locationAddress: string | null
    contactName: string | null
    contactPhone: string | null
    tasks: {
        id: string
        title: string
        status: string
    }[]
}

// ==================== Request DTOs ====================

/**
 * DTO for creating installation work order
 */
export interface CreateInstallationDTO {
    pelangganId: string
    departmentId?: string
    siteId?: string
    scheduledDate?: string
    notes?: string
}

/**
 * DTO for creating disconnection work order
 */
export interface CreateDisconnectionDTO {
    pelangganId: string
    reason: string
    departmentId?: string
    siteId?: string
    notes?: string
}

/**
 * DTO for creating troubleshooting work order
 */
export interface CreateTroubleshootingDTO {
    pelangganId?: string
    ticketId?: string
    title: string
    description: string
    priority?: WorkOrderPriority
    departmentId?: string
    siteId?: string
    scheduledDate?: string
}

/**
 * DTO for creating general/maintenance work order
 */
export interface CreateMaintenanceDTO {
    title: string
    description: string
    priority?: WorkOrderPriority
    departmentId?: string
    siteId?: string
    scheduledDate?: string
    isInternal?: boolean
}
