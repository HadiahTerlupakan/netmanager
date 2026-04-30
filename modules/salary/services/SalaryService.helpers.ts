import { logActivitySafe } from "@/lib/logger";
import type {
  ISalaryRepository,
  SalaryFilters,
  UpdateSalaryInput,
} from "../domain/ports/ISalaryRepository";
import type {
  SalaryEntity,
  SalaryWithDetailsEntity,
} from "../domain/entities/SalaryEntity";

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface SalaryListResult {
  salaries: SalaryWithDetailsEntity[];
  total: number;
  page: number;
  totalPages: number;
  stats?: {
    total: number;
    draft: number;
    calculated: number;
    audited: number;
    approved: number;
    paid: number;
    totalNetSalary: number;
  };
}

/** Membuat response not found standar untuk proses gaji. */
export function buildSalaryNotFoundResult<T>(): ServiceResult<T> {
  return { success: false, error: "Gaji tidak ditemukan", code: "NOT_FOUND" };
}

/** Membuat response invalid status standar untuk proses gaji. */
export function buildInvalidStatusResult<T>(error: string): ServiceResult<T> {
  return { success: false, error, code: "INVALID_STATUS" };
}

/** Mengambil statistik periode bila filter mengandung bulan dan tahun. */
export async function getSalaryPeriodStats(
  repository: ISalaryRepository,
  filters: SalaryFilters,
) {
  if (!filters.month || !filters.year) {
    return undefined;
  }

  return repository.getPeriodStats(filters.month, filters.year);
}

/** Membuat payload update salary yang diizinkan dari input service. */
export function buildSalaryUpdatePayload(data: { auditNotes?: string }) {
  const updateData: UpdateSalaryInput = {};
  if (data.auditNotes !== undefined) {
    updateData.auditNotes = data.auditNotes;
  }
  return updateData;
}

/** Menulis activity log salary secara aman. */
export function logSalaryActivity(
  action: string,
  userId: string,
  details: Record<string, unknown>,
): void {
  logActivitySafe({ action, subject: "Salary", userId, details });
}

export { logActivitySafe };
export type { UpdateSalaryInput };

/** Mengubah unknown error menjadi Error bila memungkinkan. */
export function asError(error: unknown): Error | undefined {
  return error instanceof Error ? error : undefined;
}

/** Memastikan salary tersedia sebelum proses lanjutan dilakukan. */
export async function findExistingSalary(
  repository: ISalaryRepository,
  id: string,
) {
  return repository.findById(id);
}

/** Mengecek bahwa status salary sesuai daftar yang diizinkan. */
export function hasAllowedSalaryStatus(
  salary: SalaryEntity | SalaryWithDetailsEntity,
  allowedStatuses: string[],
) {
  return allowedStatuses.includes(salary.status);
}
