/**
 * RoleMapper
 *
 * Transforms Prisma entities to domain entities and domain entities to DTOs.
 */

import type { Permission, Role } from "@prisma/client";
import type {
  PermissionDTO,
  PermissionGroupDTO,
  RoleDetailDTO,
  RoleListItemDTO,
  RoleOptionDTO,
} from "../dto/RoleDTO";
import type {
  PermissionEntity,
  RoleEntity,
} from "../domain/entities/RoleEntity";

export type PrismaRoleWithCount = Role & {
  _count?: {
    user?: number;
  };
};

export type PrismaRoleWithPermissions = Role & {
  permission?: Permission[];
  _count?: {
    user?: number;
  };
};

export class RoleMapper {
  /** Map Prisma role to domain entity. */
  static toDomain(entity: PrismaRoleWithPermissions): RoleEntity {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      accessAdminPanel: entity.accessAdminPanel,
      accessEmployeePanel: entity.accessEmployeePanel,
      isRestricted: entity.isRestricted,
      isTechnical: entity.isTechnical,
      isSuperAdmin: entity.isSuperAdmin,
      canApproveRab: entity.canApproveRab,
      canReceiveWhatsappApproval: entity.canReceiveWhatsappApproval,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      permissions: this.toPermissionDomains(entity.permission ?? []),
      counts: { users: entity._count?.user ?? 0 },
    };
  }

  /** Map many Prisma roles to domain entities. */
  static toDomains(entities: PrismaRoleWithPermissions[]): RoleEntity[] {
    return entities.map((entity) => this.toDomain(entity));
  }

  /** Map domain entity to list DTO. */
  static toListItemDTO(entity: RoleEntity): RoleListItemDTO {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      userCount: entity.counts?.users ?? 0,
      accessAdminPanel: entity.accessAdminPanel,
      accessEmployeePanel: entity.accessEmployeePanel,
      isRestricted: entity.isRestricted,
      isTechnical: entity.isTechnical,
    };
  }

  /** Map many domain entities to list DTOs. */
  static toListItemDTOs(entities: RoleEntity[]): RoleListItemDTO[] {
    return entities.map((entity) => this.toListItemDTO(entity));
  }

  /** Map domain entity to detail DTO. */
  static toDetailDTO(entity: RoleEntity): RoleDetailDTO {
    const permissions = entity.permissions;
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      accessAdminPanel: entity.accessAdminPanel,
      accessEmployeePanel: entity.accessEmployeePanel,
      isRestricted: entity.isRestricted,
      isTechnical: entity.isTechnical,
      isSuperAdmin: entity.isSuperAdmin,
      canApproveRab: entity.canApproveRab,
      canReceiveWhatsappApproval: entity.canReceiveWhatsappApproval,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      permissions: this.groupPermissions(permissions),
      permissionList: permissions.map(
        (permission) => `${permission.resource}:${permission.action}`,
      ),
      userCount: entity.counts?.users ?? 0,
    };
  }

  /** Map domain entity to option DTO. */
  static toOptionDTO(entity: RoleEntity): RoleOptionDTO {
    return {
      id: entity.id,
      name: entity.name,
      isRestricted: entity.isRestricted,
    };
  }

  /** Map many domain entities to option DTOs. */
  static toOptionDTOs(entities: RoleEntity[]): RoleOptionDTO[] {
    return entities.map((entity) => this.toOptionDTO(entity));
  }

  /** Map domain permission to DTO. */
  static toPermissionDTO(entity: PermissionEntity): PermissionDTO {
    return {
      id: entity.id,
      name: entity.name,
      resource: entity.resource,
      action: entity.action,
      description: entity.description,
    };
  }

  /** Group permissions by resource. */
  static groupPermissions(
    permissions: PermissionEntity[],
  ): PermissionGroupDTO[] {
    const groups = new Map<string, string[]>();
    for (const permission of permissions) {
      const actions = groups.get(permission.resource) ?? [];
      actions.push(permission.action);
      groups.set(permission.resource, actions);
    }

    return Array.from(groups.entries())
      .map(([resource, actions]) => ({ resource, actions: actions.sort() }))
      .sort((first, second) => first.resource.localeCompare(second.resource));
  }

  private static toPermissionDomains(
    permissions: Permission[],
  ): PermissionEntity[] {
    return permissions.map((permission) => ({
      id: permission.id,
      name: permission.name,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
    }));
  }
}
