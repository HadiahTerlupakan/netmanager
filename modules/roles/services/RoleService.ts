import { invalidateRolePermissionCache } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth/super-admin";
import { expandMobilePermissionDependencies } from "@/lib/mobile-permission-dependencies";
import { sanitizePermissionsByPanelAccess } from "@/lib/permission-sanitizer";
import { isMainTenant } from "@/modules/mitra";
import type { RoleDetailDTO, RoleListItemDTO } from "../dto/RoleDTO";
import type { RoleEntity } from "../domain/entities/RoleEntity";
import type {
  IRoleRepository,
  RoleFilterOptions,
} from "../domain/ports/IRoleRepository";
import {
  createPermissionRepository,
  createRoleRepository,
} from "../factories/RepositoryFactory";
import { RoleMapper } from "../mappers/RoleMapper";
import { PermissionRepository } from "../repositories/PermissionRepository";
import { resolvePermissionIds } from "./role-permission-helpers";
import {
  buildRolePayload,
  toCreateRoleRepositoryInput,
  toUpdateRoleRepositoryInput,
} from "./role-service.payloads";
import type {
  RoleMutationContext,
  RoleMutationInput,
} from "./role-service.types";

const RESTRICTED_SENSITIVE_RESOURCES = new Set([
  "backup_database",
  "app_version",
  "tenants",
]);
const SENSITIVE_PERMISSION_MESSAGE =
  "Hanya tenant utama yang dapat memberikan hak akses administratif sensitif (Backup, App Version, Tenants)";
const SUPER_ADMIN_CREATE_MESSAGE =
  "Hanya tenant utama yang dapat membuat role Super Admin";
const SUPER_ADMIN_UPDATE_MESSAGE =
  "Hanya tenant utama yang dapat mengelola role Super Admin";
const SUPER_ADMIN_ROLE_NAME = "SUPER_ADMIN";
const SUPER_ADMIN_ACTOR_MESSAGE =
  "Hanya super admin yang dapat memberikan status super admin pada role";

export class RolePolicyError extends Error {
  public readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, RolePolicyError.prototype);
  }
}

export class RoleService {
  private readonly roleRepository: IRoleRepository;
  private readonly permissionRepository: PermissionRepository;

  constructor(
    roleRepository: IRoleRepository = createRoleRepository(),
    permissionRepository: PermissionRepository = createPermissionRepository(),
  ) {
    this.roleRepository = roleRepository;
    this.permissionRepository = permissionRepository;
  }

  /** Get current user role context for restricted filtering. */
  async getCurrentUserRoleContext(userId?: string | null) {
    return this.roleRepository.findUserRoleContext(userId ?? null);
  }

  /** Get all roles as list DTOs. */
  async getAllRoles(filter?: RoleFilterOptions): Promise<RoleListItemDTO[]> {
    const roles = await this.roleRepository.findAll(filter);
    return RoleMapper.toListItemDTOs(roles);
  }

  /** Get roles for hak akses screen with restriction rules. */
  async getRolesForHakAkses(
    filterRestricted?: boolean,
    currentUserId?: string | null,
  ) {
    if (!filterRestricted) {
      return this.getAllRoles();
    }

    const currentUserRoleContext = await this.getCurrentUserRoleContext(
      currentUserId ?? null,
    );
    return this.getAllRoles({
      filterRestricted: true,
      currentUserRoleId: currentUserRoleContext.roleId,
      currentUserRoleName: currentUserRoleContext.roleName,
    });
  }

  /** Get role domain entity by ID. */
  async getRole(id: string): Promise<RoleEntity | null> {
    return this.roleRepository.findById(id);
  }

  /** Get role detail DTO by ID. */
  async getRoleWithPermissions(id: string): Promise<RoleDetailDTO | null> {
    const role = await this.roleRepository.findByIdWithPermissions(id);
    return role ? RoleMapper.toDetailDTO(role) : null;
  }

  /** Create role with tenant policy validation. */
  async createRoleWithPolicy(
    input: RoleMutationInput,
    context?: RoleMutationContext,
  ): Promise<RoleDetailDTO> {
    const permissions = await this.sanitizePermissions(input);
    this.ensureSuperAdminAllowed(
      this.grantsSuperAdmin(input),
      SUPER_ADMIN_CREATE_MESSAGE,
      context?.tenantId,
      context?.actorIsSuperAdmin,
    );
    this.ensureSensitivePermissionsAllowed(permissions, context?.tenantId);
    return this.createRole(buildRolePayload(input, permissions));
  }

  /** Update role with tenant policy validation. */
  async updateRoleWithPolicy(
    id: string,
    input: RoleMutationInput,
    context?: RoleMutationContext,
  ): Promise<RoleDetailDTO> {
    const permissions = await this.sanitizePermissions(input);
    this.ensureSuperAdminAllowed(
      this.grantsSuperAdmin(input),
      SUPER_ADMIN_UPDATE_MESSAGE,
      context?.tenantId,
      context?.actorIsSuperAdmin,
    );
    this.ensureSensitivePermissionsAllowed(permissions, context?.tenantId);
    return this.updateRole(id, buildRolePayload(input, permissions));
  }

  /** Create role and return detail DTO. */
  async createRole(data: RoleMutationInput): Promise<RoleDetailDTO> {
    const existingRole = await this.roleRepository.findByName(data.name);
    if (existingRole) {
      throw new Error("Role dengan nama ini sudah ada");
    }

    const permissionIds = await resolvePermissionIds(
      this.permissionRepository,
      data.permissions,
    );
    const role = await this.roleRepository.create(
      toCreateRoleRepositoryInput(data, permissionIds),
    );
    return RoleMapper.toDetailDTO(role);
  }

  /** Update role and return detail DTO. */
  async updateRole(
    id: string,
    data: RoleMutationInput,
  ): Promise<RoleDetailDTO> {
    const currentRole = await this.roleRepository.findById(id);
    if (!currentRole) {
      throw new Error("Role tidak ditemukan");
    }

    if (
      currentRole.name === SUPER_ADMIN_ROLE_NAME &&
      data.name !== SUPER_ADMIN_ROLE_NAME
    ) {
      throw new Error("Tidak dapat mengubah nama role SUPER_ADMIN");
    }

    const permissionIds = await resolvePermissionIds(
      this.permissionRepository,
      data.permissions,
    );
    const updatedRole = await this.roleRepository.update(
      id,
      toUpdateRoleRepositoryInput(data, permissionIds),
    );
    await invalidateRolePermissionCache(id);
    return RoleMapper.toDetailDTO(updatedRole);
  }

  /** Delete role and return deleted detail DTO. */
  async deleteRole(id: string): Promise<RoleDetailDTO> {
    const currentRole = await this.roleRepository.findById(id);
    if (!currentRole) {
      throw new Error("Role tidak ditemukan");
    }

    if (currentRole.name === SUPER_ADMIN_ROLE_NAME) {
      throw new Error("Tidak dapat menghapus role SUPER_ADMIN");
    }

    const userCount = await this.roleRepository.countUsers(id);
    if (userCount > 0) {
      throw new Error(
        "Tidak dapat menghapus role yang masih memiliki pengguna",
      );
    }

    const deletedRole = await this.roleRepository.delete(id);
    return RoleMapper.toDetailDTO(deletedRole);
  }

  private async sanitizePermissions(
    input: RoleMutationInput,
  ): Promise<string[]> {
    const sanitized = await sanitizePermissionsByPanelAccess(
      input.permissions,
      input.accessAdminPanel ?? false,
      input.accessEmployeePanel ?? false,
    );
    return expandMobilePermissionDependencies(sanitized);
  }

  /**
   * Menjaga pembuatan/pengubahan role yang berujung superadmin.
   *
   * Status superadmin bisa datang dari DUA arah: flag `isSuperAdmin`, dan nama
   * role yang cocok dengan `isSuperAdminRole()` (`"SUPER_ADMIN"` /
   * `"Super Admin"`). Sebelumnya hanya flag yang dijaga, sehingga pemegang
   * `roles:update` cukup me-rename role-nya sendiri untuk menjadi superadmin —
   * sekaligus melewati kebijakan tenant yang hanya menempel di flag.
   *
   * Selain tenant utama, kini pemanggilnya sendiri wajib superadmin: memberi
   * superadmin adalah wewenang superadmin, bukan wewenang pengelola role.
   */
  private ensureSuperAdminAllowed(
    grantsSuperAdmin: boolean,
    message: string,
    tenantId?: string | null,
    actorIsSuperAdmin?: boolean,
  ) {
    if (!grantsSuperAdmin) {
      return;
    }

    if (!isMainTenant(tenantId ?? null)) {
      throw new RolePolicyError(message);
    }

    if (!actorIsSuperAdmin) {
      throw new RolePolicyError(SUPER_ADMIN_ACTOR_MESSAGE);
    }
  }

  /** Role dianggap memberi superadmin bila flag-nya menyala ATAU namanya ajaib. */
  private grantsSuperAdmin(input: RoleMutationInput): boolean {
    return Boolean(input.isSuperAdmin) || isSuperAdminRole(input.name);
  }

  private ensureSensitivePermissionsAllowed(
    permissions: string[],
    tenantId?: string | null,
  ) {
    if (isMainTenant(tenantId ?? null)) {
      return;
    }

    const hasRestricted = permissions.some((permission) => {
      const [resource] = permission.split(":");
      return RESTRICTED_SENSITIVE_RESOURCES.has(resource);
    });

    if (hasRestricted) {
      throw new RolePolicyError(SENSITIVE_PERMISSION_MESSAGE);
    }
  }
}

let roleServiceInstance: RoleService | null = null;

/** Get singleton role service instance. */
export function getRoleService(): RoleService {
  if (!roleServiceInstance) {
    roleServiceInstance = new RoleService();
  }

  return roleServiceInstance;
}
