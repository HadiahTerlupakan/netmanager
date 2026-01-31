/**
 * ShiftMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Shift } from '@prisma/client'
import type {
    ShiftListItemDTO,
    ShiftDetailDTO,
    ShiftOptionDTO,
} from '../dto/ShiftDTO'

// Extended types
type ShiftWithRelations = Shift & {
    users?: {
        id: string
        name: string | null
        email: string
    }[]
    _count?: {
        users?: number
    }
}

export class ShiftMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: ShiftWithRelations): ShiftListItemDTO {
        return {
            id: entity.id,
            name: entity.name,
            code: entity.code,
            startTime: entity.startTime,
            endTime: entity.endTime,
            isActive: entity.isActive,
            userCount: entity._count?.users ?? entity.users?.length ?? 0,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: ShiftWithRelations[]): ShiftListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: ShiftWithRelations): ShiftDetailDTO {
        return {
            id: entity.id,
            name: entity.name,
            code: entity.code,
            startTime: entity.startTime,
            endTime: entity.endTime,
            description: entity.description,
            isActive: entity.isActive,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            users: (entity.users ?? []).map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
            })),
        }
    }

    /**
     * Map to option DTO (for dropdowns)
     */
    static toOption(entity: Shift): ShiftOptionDTO {
        return {
            id: entity.id,
            name: entity.name,
            code: entity.code,
            time: `${entity.startTime} - ${entity.endTime}`,
        }
    }

    /**
     * Map array to options
     */
    static toOptions(entities: Shift[]): ShiftOptionDTO[] {
        return entities.map(entity => this.toOption(entity))
    }
}
