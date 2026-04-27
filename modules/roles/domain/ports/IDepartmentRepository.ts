import type { DepartmentEntity } from "../entities/DepartmentEntity";

export interface DepartmentFilterOptions {
  search?: string;
  reminderOnly?: boolean;
}

export interface CreateDepartmentRepositoryInput {
  id: string;
  name: string;
  description?: string | null;
  jobDescription?: string | null;
  isReminderTarget?: boolean;
  showInMobileWO?: boolean;
  updatedAt: Date;
}

export interface UpdateDepartmentRepositoryInput {
  name?: string;
  description?: string | null;
  jobDescription?: string | null;
  isReminderTarget?: boolean;
  showInMobileWO?: boolean;
}

export interface IDepartmentRepository {
  /** Get all departments with optional filter. */
  findAll(filters?: DepartmentFilterOptions): Promise<DepartmentEntity[]>;
  /** Find department by ID with details. */
  findById(id: string): Promise<DepartmentEntity | null>;
  /** Find department by name. */
  findByName(name: string): Promise<DepartmentEntity | null>;
  /** Create a department entity. */
  create(data: CreateDepartmentRepositoryInput): Promise<DepartmentEntity>;
  /** Update a department entity. */
  update(
    id: string,
    data: UpdateDepartmentRepositoryInput,
  ): Promise<DepartmentEntity>;
  /** Find department by ID for delete checks. */
  findByIdWithCounts(id: string): Promise<DepartmentEntity | null>;
  /** Delete department by ID. */
  delete(id: string): Promise<void>;
}
