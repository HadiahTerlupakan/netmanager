/**
 * DepartmentMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Departments } from '@prisma/client'
import type {
    DepartmentListItemDTO,
    DepartmentDetailDTO,
    DepartmentOptionDTO,
} from '../dto/DepartmentDTO'

// Extended types
type DepartmentWithCounts = Departments & {
    _count?: {
        user?: number
        work_orders?: number
    }
    user?: {
        id: string
        name: string | null
        email: string
    }[]
}

export class DepartmentMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: DepartmentWithCounts): DepartmentListItemDTO {
        return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            isReminderTarget: entity.isReminderTarget,
            userCount: entity._count?.user ?? 0,
            workOrderCount: entity._count?.work_orders ?? 0,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: DepartmentWithCounts[]): DepartmentListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: DepartmentWithCounts): DepartmentDetailDTO {
        return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            jobDescription: entity.jobDescription,
            isReminderTarget: entity.isReminderTarget,
            stats: {
                userCount: entity._count?.user ?? 0,
                workOrderCount: entity._count?.work_orders ?? 0,
            },
            users: (entity.user ?? []).map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
            })),
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
        }
    }

    /**
     * Map to option DTO (for dropdowns)
     */
    static toOption(entity: Departments): DepartmentOptionDTO {
        return {
            id: entity.id,
            name: entity.name,
        }
    }

    /**
     * Map array to options
     */
    static toOptions(entities: Departments[]): DepartmentOptionDTO[] {
        return entities.map(entity => this.toOption(entity))
    }
}
