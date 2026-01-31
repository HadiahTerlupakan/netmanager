/**
 * Asset DTOs (Data Transfer Objects)
 */

import type { AssetStatus } from '@prisma/client'

// ==================== Response DTOs ====================

/**
 * DTO for asset list views
 */
export interface AssetListItemDTO {
    id: string
    kodeAsset: string
    barangName: string
    barangCode: string
    status: AssetStatus
    location: string | null
    assignedToName: string | null
    currentValue: number
    purchaseDate: string
}

/**
 * DTO for asset detail views
 */
export interface AssetDetailDTO {
    id: string
    kodeAsset: string
    status: AssetStatus
    location: string | null
    purchaseDate: string
    purchasePrice: number
    currentValue: number
    residualValue: number
    usefulLife: number
    createdAt: string
    updatedAt: string
    barang: {
        id: string
        name: string
        code: string
        category: string | null
    }
    assignedTo: {
        id: string
        name: string | null
        email: string
    } | null
    depreciationLogs: AssetDepreciationLogDTO[]
}

/**
 * DTO for depreciation log
 */
export interface AssetDepreciationLogDTO {
    id: string
    date: string
    amount: number
    notes: string | null
}

/**
 * DTO for asset option (dropdowns)
 */
export interface AssetOptionDTO {
    id: string
    kodeAsset: string
    barangName: string
}

// ==================== Request DTOs ====================

/**
 * DTO for creating asset
 */
export interface CreateAssetDTO {
    barangId: string
    kodeAsset: string
    purchaseDate: string
    purchasePrice: number
    currentValue: number
    residualValue?: number
    usefulLife: number
    status?: AssetStatus
    location?: string
    assignedTo?: string
}

/**
 * DTO for updating asset
 */
export interface UpdateAssetDTO {
    status?: AssetStatus
    location?: string
    assignedTo?: string | null
    currentValue?: number
}
