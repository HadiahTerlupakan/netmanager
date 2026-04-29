import type { RoleEntity, UserRoleContextEntity } from "../entities/RoleEntity";

export interface RoleFilterOptions {
  filterRestricted?: boolean;
  currentUserRoleId?: string | null;
  currentUserRoleName?: string | null;
}

export interface CreateRoleRepositoryInput {
  name: string;
  description?: string;
  accessAdminPanel?: boolean;
  accessEmployeePanel?: boolean;
  isRestricted?: boolean;
  isTechnical?: boolean;
  isSuperAdmin?: boolean;
  canApproveRab?: boolean;
  canReceiveWhatsappApproval?: boolean;
  permissionIds?: string[];
}

export interface UpdateRoleRepositoryInput {
  name?: string;
  description?: string;
  accessAdminPanel?: boolean;
  accessEmployeePanel?: boolean;
  isRestricted?: boolean;
  isTechnical?: boolean;
  isSuperAdmin?: boolean;
  canApproveRab?: boolean;
  canReceiveWhatsappApproval?: boolean;
  permissionIds?: string[];
}

export interface IRoleRepository {
  /** Get all roles with optional restriction filter. */
  findAll(filter?: RoleFilterOptions): Promise<RoleEntity[]>;
  /** Get user role context for access filtering. */
  findUserRoleContext(userId?: string | null): Promise<UserRoleContextEntity>;
  /** Find role by ID. */
  findById(id: string): Promise<RoleEntity | null>;
  /** Find role by ID with permissions loaded. */
  findByIdWithPermissions(id: string): Promise<RoleEntity | null>;
  /** Find role by name. */
  findByName(name: string): Promise<RoleEntity | null>;
  /** Create a new role entity. */
  create(data: CreateRoleRepositoryInput): Promise<RoleEntity>;
  /** Update an existing role entity. */
  update(id: string, data: UpdateRoleRepositoryInput): Promise<RoleEntity>;
  /** Delete role entity by ID. */
  delete(id: string): Promise<RoleEntity>;
  /** Count users assigned to a role. */
  countUsers(id: string): Promise<number>;
}
