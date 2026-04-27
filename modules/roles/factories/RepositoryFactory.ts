import type { IDepartmentRepository } from "../domain/ports/IDepartmentRepository";
import type { IRoleRepository } from "../domain/ports/IRoleRepository";
import type { ISiteRepository } from "../domain/ports/ISiteRepository";
import { DepartmentRepository } from "../repositories/DepartmentRepository";
import { PermissionRepository } from "../repositories/PermissionRepository";
import { RoleRepository } from "../repositories/RoleRepository";
import { SiteRepository } from "../repositories/SiteRepository";

/** Create default role repository implementation. */
export function createRoleRepository(): IRoleRepository {
  return new RoleRepository();
}

/** Create default site repository implementation. */
export function createSiteRepository(): ISiteRepository {
  return new SiteRepository();
}

/** Create default department repository implementation. */
export function createDepartmentRepository(): IDepartmentRepository {
  return new DepartmentRepository();
}

/** Create default permission repository implementation. */
export function createPermissionRepository(): PermissionRepository {
  return new PermissionRepository();
}
