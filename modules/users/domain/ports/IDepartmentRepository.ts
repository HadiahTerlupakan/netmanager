import type { DepartmentEntity } from "../entities/DepartmentEntity";

export interface DepartmentCreateData {
  name: string;
  description?: string | null;
  jobDescription?: string | null;
}

export interface DepartmentUpdateData {
  name?: string;
  description?: string | null;
  jobDescription?: string | null;
}

export interface IDepartmentRepository {
  /** Get all departments with user counts. */
  findAll(): Promise<DepartmentEntity[]>;
  /** Get department by id. */
  findById(id: string): Promise<DepartmentEntity | null>;
  /** Get department by name. */
  findByName(name: string): Promise<DepartmentEntity | null>;
  /** Create a department entity. */
  create(data: DepartmentCreateData): Promise<{ id: string }>;
  /** Update a department entity. */
  update(id: string, data: DepartmentUpdateData): Promise<void>;
  /** Delete a department entity. */
  delete(id: string): Promise<void>;
  /** Count total departments. */
  count(): Promise<number>;
}
