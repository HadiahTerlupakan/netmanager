/**
 * RoleMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Role, Permission } from '@prisma/client'
import type {
    RoleListItemDTO,
    RoleDetailDTO,
    RoleOptionDTO,
    PermissionGroupDTO,
    PermissionDTO,
} from '../dto/RoleDTO'

// Extended types
type RoleWithCount = Role & {
    _count?: {
        users?: number
    }
}

type RoleWithPermissions = Role & {
    permissions?: Permission[]
    _count?: {
        users?: number
    }
}

export class RoleMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: RoleWithCount): RoleListItemDTO {
        return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            userCount: entity._count?.users ?? 0,
            accessAdminPanel: entity.accessAdminPanel,
            accessEmployeePanel: entity.accessEmployeePanel,
            isRestricted: entity.isRestricted,
            isTechnical: entity.isTechnical,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: RoleWithCount[]): RoleListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: RoleWithPermissions): RoleDetailDTO {
        const permissions = entity.permissions ?? []
        const permissionGroups = this.groupPermissions(permissions)
        const permissionList = permissions.map(p => `${p.resource}:${p.action}`)

        return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            accessAdminPanel: entity.accessAdminPanel,
            accessEmployeePanel: entity.accessEmployeePanel,
            isRestricted: entity.isRestricted,
            isTechnical: entity.isTechnical,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            permissions: permissionGroups,
            permissionList,
            userCount: entity._count?.users ?? 0,
        }
    }

    /**
     * Map to option DTO (for dropdowns)
     */
    static toOption(entity: Role): RoleOptionDTO {
        return {
            id: entity.id,
            name: entity.name,
            isRestricted: entity.isRestricted,
        }
    }

    /**
     * Map array to options
     */
    static toOptions(entities: Role[]): RoleOptionDTO[] {
        return entities.map(entity => this.toOption(entity))
    }

    /**
     * Map permission to DTO
     */
    static toPermission(entity: Permission): PermissionDTO {
        return {
            id: entity.id,
            name: entity.name,
            resource: entity.resource,
            action: entity.action,
            description: entity.description,
        }
    }

    /**
     * Group permissions by resource
     */
    static groupPermissions(permissions: Permission[]): PermissionGroupDTO[] {
        const groups = new Map<string, string[]>()

        for (const perm of permissions) {
            const existing = groups.get(perm.resource) ?? []
            existing.push(perm.action)
            groups.set(perm.resource, existing)
        }

        return Array.from(groups.entries()).map(([resource, actions]) => ({
            resource,
            actions: actions.sort(),
        })).sort((a, b) => a.resource.localeCompare(b.resource))
    }
}
