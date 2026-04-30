import { logger } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type { ServiceResult, UserContext } from "./WorkOrderService";
import type {
  WorkOrderFilters,
  WorkOrderListSummary,
} from "../domain/ports/IWorkOrderRepository";

export const EMPTY_WORK_ORDER_LIST_SUMMARY: WorkOrderListSummary = {
  completed: 0,
  unfinished: 0,
  focut: 0,
  dismantle: 0,
  averageCompletionTimeHours: 0,
  topCustomers: [],
};

/** Terapkan pembatasan akses user ke filter daftar work order. */
export function applyWorkOrderListRestrictions(input: {
  filters: WorkOrderFilters;
  userPermissions?: string[];
  userDepartmentId?: string;
  userSiteId?: string;
  userRole?: string;
}): WorkOrderFilters | null {
  const appliedFilters = { ...input.filters };
  const userPermissions = input.userPermissions ?? [];
  const isSuperAdmin = input.userRole === "SUPER_ADMIN";

  if (userPermissions.includes("workorders:department_only") && !isSuperAdmin) {
    if (!input.userDepartmentId) {
      return null;
    }
    appliedFilters.departmentId = input.userDepartmentId;
  }

  if (userPermissions.includes("workorders:site_only") && !isSuperAdmin) {
    if (!input.userSiteId) {
      return null;
    }
    appliedFilters.siteId = input.userSiteId;
  }

  return appliedFilters;
}

/** Buat respons daftar work order kosong yang konsisten. */
export function createEmptyWorkOrderListResult(page: number): ServiceResult<{
  workOrders: unknown[];
  total: number;
  page: number;
  totalPages: number;
  summary: WorkOrderListSummary;
}> {
  return {
    success: true,
    data: {
      workOrders: [],
      total: 0,
      page,
      totalPages: 0,
      summary: EMPTY_WORK_ORDER_LIST_SUMMARY,
    },
  };
}

/** Bentuk kode error service work order dari objek error. */
export function getWorkOrderErrorCode(
  error: unknown,
  fallbackCode: string,
): string {
  if (error instanceof Error && error.message.includes("Akses ditolak")) {
    return "FORBIDDEN";
  }

  return fallbackCode;
}

/** Bentuk respons not found work order yang konsisten. */
export function createWorkOrderNotFoundResult<T>(): ServiceResult<T> {
  return {
    success: false,
    error: "Work order tidak ditemukan",
    code: "NOT_FOUND",
  };
}

/** Cek apakah error merepresentasikan work order yang tidak ditemukan. */
export function isWorkOrderNotFoundError(error: unknown): boolean {
  return (
    isPrismaRecordNotFoundError(error) ||
    (error instanceof Error && error.message === "Work order tidak ditemukan")
  );
}

/** Cek apakah pesan error termasuk validasi input mobile material. */
export function isMobileMaterialValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return ["wajib", "harus", "Stok", "Data stok", "Kondisi"].some((keyword) =>
    error.message.includes(keyword),
  );
}

/** Cek apakah error merupakan not found umum. */
export function isGenericNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("tidak ditemukan");
}

/** Cek apakah user karyawan aktif. */
export function hasActiveEmployeeStatus(employee: {
  isActive: boolean;
}): boolean {
  return employee.isActive;
}

/** Format pesan karyawan tidak aktif yang konsisten. */
export function buildInactiveEmployeeMessage(
  employeeName: string | null,
): string {
  return `Tidak dapat menugaskan work order ke karyawan yang tidak aktif: ${employeeName || "Tidak Diketahui"}`;
}

/** Catat error service work order secara konsisten. */
export function logWorkOrderServiceError(scope: string, error: unknown): void {
  logger.error(scope, error instanceof Error ? error : undefined);
}

/** Ambil user tenant efektif dari work order atau context user. */
export function resolveTenantIdFromContext(input: {
  workOrderTenantId: string | null | undefined;
  userContext: UserContext;
}): string | undefined {
  return input.workOrderTenantId || input.userContext.tenantId || undefined;
}
