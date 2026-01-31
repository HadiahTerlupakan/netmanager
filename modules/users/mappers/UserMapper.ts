/**
 * UserMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 * Ensures passwordHash and other sensitive fields are never exposed.
 */

import type { User } from '@prisma/client'
import type { UserWithRelations } from '../repositories/UserRepository'
import type {
    UserListItemDTO,
    UserDetailDTO,
    UserSessionDTO,
    UserOptionDTO,
    EmployeeAssignmentDTO,
} from '../dto/UserDTO'

export class UserMapper {
    /**
     * Map to list item DTO (for table views)
     * Never exposes passwordHash
     */
    static toListItem(entity: UserWithRelations): UserListItemDTO {
        return {
            id: entity.id,
            email: entity.email,
            name: entity.name,
            phone: entity.phone,
            isActive: entity.isActive,
            isSales: entity.isSales,
            // Flattened relations
            roleName: entity.role?.name ?? null,
            departmentName: entity.department?.name ?? null,
            siteName: entity.site?.name ?? null,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: UserWithRelations[]): UserListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO (for single view)
     */
    static toDetail(entity: UserWithRelations): UserDetailDTO {
        return {
            id: entity.id,
            email: entity.email,
            name: entity.name,
            phone: entity.phone,
            isActive: entity.isActive,
            isSales: entity.isSales,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            // Relations
            role: entity.role ? {
                id: entity.role.id,
                name: entity.role.name,
            } : null,
            department: entity.department ? {
                id: entity.department.id,
                name: entity.department.name,
            } : null,
            site: entity.site ? {
                id: entity.site.id,
                name: entity.site.name,
            } : null,
            // Working hours
            workingHours: {
                mode: entity.workingHourMode,
                startWorkTime: entity.startWorkTime,
                endWorkTime: entity.endWorkTime,
                workDays: entity.workDays,
                flexibleTargetHour: entity.flexibleTargetHour,
                shift: null, // Shift relation not included in UserWithRelations
            },
            // Multi-site
            userSites: (entity.userSites ?? []).map(us => ({
                siteId: us.siteId,
                siteName: us.site?.name ?? 'Unknown',
            })),
        }
    }

    /**
     * Map to session DTO (for auth context)
     * Minimal data needed for session
     */
    static toSession(
        entity: User & {
            role?: { name: string } | null
        },
        permissions: string[] = []
    ): UserSessionDTO {
        return {
            id: entity.id,
            email: entity.email,
            name: entity.name,
            role: entity.role?.name ?? null,
            roleId: entity.roleId,
            departmentId: entity.departmentId,
            siteId: entity.siteId,
            permissions,
        }
    }

    /**
     * Map to option DTO (for dropdowns)
     */
    static toOption(entity: UserWithRelations): UserOptionDTO {
        return {
            id: entity.id,
            name: entity.name,
            email: entity.email,
            departmentName: entity.department?.name ?? null,
        }
    }

    /**
     * Map array to options
     */
    static toOptions(entities: UserWithRelations[]): UserOptionDTO[] {
        return entities.map(entity => this.toOption(entity))
    }

    /**
     * Map to employee assignment DTO (for work order assignment)
     */
    static toEmployeeAssignment(entity: User): EmployeeAssignmentDTO {
        return {
            id: entity.id,
            name: entity.name,
            email: entity.email,
            phone: entity.phone,
            isActive: entity.isActive,
            departmentId: entity.departmentId,
            siteId: entity.siteId,
        }
    }

    /**
     * Map array to employee assignments
     */
    static toEmployeeAssignments(entities: User[]): EmployeeAssignmentDTO[] {
        return entities.map(entity => this.toEmployeeAssignment(entity))
    }
}
