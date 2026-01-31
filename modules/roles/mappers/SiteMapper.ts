/**
 * SiteMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Sites } from '@prisma/client'
import type {
    SiteListItemDTO,
    SiteDetailDTO,
    SiteOptionDTO,
} from '../dto/SiteDTO'

// Extended types
type SiteWithCounts = Sites & {
    _count?: {
        user?: number
        work_orders?: number
        pelanggan?: number
    }
    gudangs?: {
        id: string
        name: string
    }[]
}

export class SiteMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: SiteWithCounts): SiteListItemDTO {
        return {
            id: entity.id,
            code: entity.code,
            name: entity.name,
            address: entity.address,
            isActive: entity.isActive,
            userCount: entity._count?.user ?? 0,
            workOrderCount: entity._count?.work_orders ?? 0,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: SiteWithCounts[]): SiteListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: SiteWithCounts): SiteDetailDTO {
        return {
            id: entity.id,
            code: entity.code,
            name: entity.name,
            description: entity.description,
            address: entity.address,
            isActive: entity.isActive,
            location: {
                latitude: entity.latitude,
                longitude: entity.longitude,
                attendanceRadius: entity.attendanceRadius ?? 100,
            },
            stats: {
                userCount: entity._count?.user ?? 0,
                workOrderCount: entity._count?.work_orders ?? 0,
                pelangganCount: entity._count?.pelanggan ?? 0,
            },
            gudangs: (entity.gudangs ?? []).map(g => ({
                id: g.id,
                name: g.name,
            })),
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
        }
    }

    /**
     * Map to option DTO (for dropdowns)
     */
    static toOption(entity: Sites): SiteOptionDTO {
        return {
            id: entity.id,
            code: entity.code,
            name: entity.name,
        }
    }

    /**
     * Map array to options
     */
    static toOptions(entities: Sites[]): SiteOptionDTO[] {
        return entities.map(entity => this.toOption(entity))
    }
}
