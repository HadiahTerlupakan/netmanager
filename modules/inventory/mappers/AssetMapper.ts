/**
 * AssetMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Asset, AssetDepreciationLog } from '@prisma/client'
import type {
    AssetListItemDTO,
    AssetDetailDTO,
    AssetOptionDTO,
    AssetDepreciationLogDTO,
} from '../dto/AssetDTO'

// Extended types
type AssetWithRelations = Asset & {
    barang?: {
        id: string
        name: string
        code: string
        category?: string | null
    }
    user?: {
        id: string
        name: string | null
        email: string
    } | null
    depreciationLogs?: AssetDepreciationLog[]
}

export class AssetMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: AssetWithRelations): AssetListItemDTO {
        return {
            id: entity.id,
            kodeAsset: entity.kodeAsset,
            barangName: entity.barang?.name ?? '',
            barangCode: entity.barang?.code ?? '',
            status: entity.status,
            location: entity.location,
            assignedToName: entity.user?.name ?? null,
            currentValue: this.toNumber(entity.currentValue),
            purchaseDate: entity.purchaseDate.toISOString(),
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: AssetWithRelations[]): AssetListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: AssetWithRelations): AssetDetailDTO {
        return {
            id: entity.id,
            kodeAsset: entity.kodeAsset,
            status: entity.status,
            location: entity.location,
            purchaseDate: entity.purchaseDate.toISOString(),
            purchasePrice: this.toNumber(entity.purchasePrice),
            currentValue: this.toNumber(entity.currentValue),
            residualValue: this.toNumber(entity.residualValue),
            usefulLife: entity.usefulLife,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            barang: entity.barang ? {
                id: entity.barang.id,
                name: entity.barang.name,
                code: entity.barang.code,
                category: entity.barang.category ?? null,
            } : {
                id: '',
                name: '',
                code: '',
                category: null,
            },
            assignedTo: entity.user ? {
                id: entity.user.id,
                name: entity.user.name,
                email: entity.user.email,
            } : null,
            depreciationLogs: this.mapDepreciationLogs(entity.depreciationLogs ?? []),
        }
    }

    /**
     * Map to option DTO (for dropdowns)
     */
    static toOption(entity: AssetWithRelations): AssetOptionDTO {
        return {
            id: entity.id,
            kodeAsset: entity.kodeAsset,
            barangName: entity.barang?.name ?? '',
        }
    }

    /**
     * Map array to options
     */
    static toOptions(entities: AssetWithRelations[]): AssetOptionDTO[] {
        return entities.map(entity => this.toOption(entity))
    }

    // ==================== Private Helpers ====================

    private static mapDepreciationLogs(logs: AssetDepreciationLog[]): AssetDepreciationLogDTO[] {
        return logs.map(log => ({
            id: log.id,
            date: log.date.toISOString(),
            amount: this.toNumber(log.amount),
            notes: log.notes,
        }))
    }

    private static toNumber(value: unknown): number {
        if (typeof value === 'bigint') {
            return Number(value)
        }
        if (typeof value === 'number') {
            return value
        }
        // Handle Prisma Decimal type
        if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
            return (value as { toNumber: () => number }).toNumber()
        }
        return Number(value) || 0
    }
}
