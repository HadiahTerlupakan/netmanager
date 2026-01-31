/**
 * Registration DTOs (Data Transfer Objects)
 */

import type { CanvasingStatus } from '@prisma/client'

// ==================== Response DTOs ====================

/**
 * DTO for registration/canvasing list views
 */
export interface RegistrationListItemDTO {
    id: string
    nama: string
    noTelpon: string
    alamat: string
    paket: string
    status: CanvasingStatus
    salesName: string | null
    createdAt: string
}

/**
 * DTO for registration detail views
 */
export interface RegistrationDetailDTO {
    id: string
    nama: string
    noKtp: string
    noTelpon: string
    email: string | null
    alamat: string
    kabel: number
    odp: string | null
    paket: string
    sn: string | null
    latitude: number | null
    longitude: number | null
    foto: string | null
    fotoKtp: string | null
    status: CanvasingStatus
    isLocked: boolean
    createdAt: string
    updatedAt: string
    sales: {
        id: string
        name: string | null
        email: string
    }
    approver: {
        id: string
        name: string | null
    } | null
    approvedAt: string | null
    workOrderId: string | null
}

/**
 * DTO for registration statistics
 */
export interface RegistrationStatisticsDTO {
    total: number
    pending: number
    approved: number
    rejected: number
    converted: number
    conversionRate: number
}

// ==================== Request DTOs ====================

/**
 * DTO for creating registration
 */
export interface CreateRegistrationDTO {
    nama: string
    noKtp: string
    noTelpon: string
    email?: string
    alamat: string
    kabel: number
    odp?: string
    paket: string
    sn?: string
    latitude?: number
    longitude?: number
    foto?: string
    fotoKtp?: string
}

/**
 * DTO for updating registration
 */
export interface UpdateRegistrationDTO {
    nama?: string
    noTelpon?: string
    alamat?: string
    paket?: string
    odp?: string
    status?: CanvasingStatus
}
