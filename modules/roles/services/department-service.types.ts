import type { DepartmentFilterOptions } from "../domain/ports/IDepartmentRepository";

export type DepartmentFilters = DepartmentFilterOptions;

export interface CreateDepartmentData {
  name: string;
  description?: string;
  jobDescription?: string;
  isReminderTarget?: boolean;
  showInMobileWO?: boolean;
}

export interface UpdateDepartmentData {
  name?: string;
  description?: string | null;
  jobDescription?: string | null;
  isReminderTarget?: boolean;
  showInMobileWO?: boolean;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
