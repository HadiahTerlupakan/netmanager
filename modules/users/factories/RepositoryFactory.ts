import type { IDepartmentRepository } from "../domain/ports/IDepartmentRepository";
import type { IUserRepository } from "../domain/ports/IUserRepository";
import { DepartmentRepository } from "../repositories/DepartmentRepository";
import { UserRepository } from "../repositories/UserRepository";

/** Create default user repository implementation. */
export function createUserRepository(): IUserRepository {
  return new UserRepository();
}

/** Create default department repository implementation. */
export function createDepartmentRepository(): IDepartmentRepository {
  return new DepartmentRepository();
}
