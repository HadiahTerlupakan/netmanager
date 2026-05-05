import { logger } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  EmployeeType,
  SalaryEntity,
} from "../domain/entities/SalaryEntity";
import { SalaryCalculationCommandService } from "./SalaryCalculationCommandService";
import {
  asError,
  logSalaryActivity,
  type ServiceResult,
} from "./SalaryService.helpers";
import { SalaryWorkflowService } from "./SalaryWorkflowService";

type SalaryCommandDependencies = {
  calculationCommandService: SalaryCalculationCommandService;
  workflowService: SalaryWorkflowService;
};

/** Jalankan kalkulasi gaji untuk satu karyawan. */
export async function calculateSingleSalary(
  deps: SalaryCommandDependencies,
  input: {
    userId: string;
    month: number;
    year: number;
    calculatedById: string;
  },
): Promise<ServiceResult<{ salaryId: string }>> {
  try {
    const { salaryId } = await deps.calculationCommandService.calculateSingle({
      userId: input.userId,
      month: input.month,
      year: input.year,
    });
    logSalaryActivity("CREATE", input.calculatedById, {
      salaryId,
      userId: input.userId,
      month: input.month,
      year: input.year,
      action: "calculate-single",
    });
    return { success: true, data: { salaryId } };
  } catch (error) {
    logger.error("SalaryService.calculateSingle failed", asError(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menghitung gaji",
      code: "CALCULATION_ERROR",
    };
  }
}

/** Jalankan kalkulasi gaji massal. */
export async function calculateBulkSalary(
  deps: SalaryCommandDependencies,
  input: {
    month: number;
    year: number;
    filters: {
      departmentId?: string;
      siteId?: string;
      employeeType?: EmployeeType;
    };
    calculatedById: string;
  },
): Promise<
  ServiceResult<{
    success: number;
    failed: Array<{ userId: string; error: string }>;
  }>
> {
  try {
    const result = await deps.calculationCommandService.calculateBulk({
      month: input.month,
      year: input.year,
      filters: input.filters,
    });
    logSalaryActivity("CREATE", input.calculatedById, {
      month: input.month,
      year: input.year,
      action: "calculate-bulk",
      successCount: result.success,
      failedCount: result.failed.length,
      filters: input.filters,
    });
    return { success: true, data: result };
  } catch (error) {
    logger.error("SalaryService.calculateBulk failed", asError(error));
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Gagal menghitung gaji massal",
      code: "BULK_CALCULATION_ERROR",
    };
  }
}

/** Setujui salary yang sudah diaudit. */
export async function approveSalaryCommand(
  deps: SalaryCommandDependencies,
  input: { id: string; approvedById: string; notes?: string },
): Promise<ServiceResult<SalaryEntity>> {
  try {
    const result = await deps.workflowService.approveSalary({
      id: input.id,
      actorId: input.approvedById,
      notes: input.notes,
    });
    if (!result.success) {
      return result;
    }

    logSalaryActivity("UPDATE", input.approvedById, {
      id: input.id,
      status: "APPROVED",
      notes: input.notes,
    });
    return result;
  } catch (error) {
    logger.error("SalaryService.approveSalary failed", asError(error));
    return {
      success: false,
      error: "Gagal menyetujui gaji",
      code: "APPROVE_ERROR",
    };
  }
}

/** Tandai salary sebagai sudah dibayar. */
export async function markSalaryAsPaid(
  deps: SalaryCommandDependencies,
  input: { id: string; paidById: string; notes?: string },
): Promise<ServiceResult<SalaryEntity>> {
  try {
    const result = await deps.workflowService.markAsPaid({
      id: input.id,
      actorId: input.paidById,
      notes: input.notes,
    });
    if (!result.success) {
      return result;
    }

    logSalaryActivity("UPDATE", input.paidById, {
      id: input.id,
      status: "PAID",
      notes: input.notes,
    });
    return result;
  } catch (error) {
    logger.error("SalaryService.markAsPaid failed", asError(error));
    return {
      success: false,
      error: "Gagal menandai gaji sebagai dibayar",
      code: "PAID_ERROR",
    };
  }
}

/** Audit salary yang sudah dihitung. */
export async function auditSalaryCommand(
  deps: SalaryCommandDependencies,
  input: { id: string; auditedById: string; notes?: string },
): Promise<ServiceResult<SalaryEntity>> {
  try {
    const result = await deps.workflowService.auditSalary({
      id: input.id,
      actorId: input.auditedById,
      notes: input.notes,
    });
    if (!result.success) {
      return result;
    }

    logSalaryActivity("UPDATE", input.auditedById, {
      id: input.id,
      status: "AUDITED",
      notes: input.notes,
    });
    return result;
  } catch (error) {
    logger.error("SalaryService.auditSalary failed", asError(error));
    return {
      success: false,
      error: "Gagal mengaudit gaji",
      code: "AUDIT_ERROR",
    };
  }
}

/** Hitung ulang salary yang sudah ada. */
export async function recalculateSalaryCommand(
  deps: SalaryCommandDependencies,
  input: { id: string; recalculatedById: string },
): Promise<ServiceResult<{ salaryId: string }>> {
  try {
    const result = await deps.calculationCommandService.recalculateSalary(
      input.id,
    );
    if (!result.success) {
      return result;
    }

    logSalaryActivity("UPDATE", input.recalculatedById, {
      id: input.id,
      salaryId: result.data.salaryId,
      action: "recalculate",
      previousStatus: result.data.previousStatus,
    });
    return { success: true, data: { salaryId: result.data.salaryId } };
  } catch (error) {
    logger.error("SalaryService.recalculateSalary failed", asError(error));
    return {
      success: false,
      error: "Gagal menghitung ulang gaji",
      code: "RECALCULATE_ERROR",
    };
  }
}

/** Hapus salary draft. */
export async function deleteSalaryCommand(
  deps: SalaryCommandDependencies,
  input: { id: string; deletedById: string },
): Promise<ServiceResult<void>> {
  try {
    const result = await deps.workflowService.deleteDraft(input.id);
    if (!result.success) {
      return { success: false, error: result.error, code: result.code };
    }

    logSalaryActivity("DELETE", input.deletedById, {
      id: input.id,
      userId: result.data.userId,
      month: result.data.month,
      year: result.data.year,
    });
    return { success: true };
  } catch (error) {
    logger.error("SalaryService.deleteSalary failed", asError(error));
    if (isPrismaRecordNotFoundError(error)) {
      return {
        success: false,
        error: "Gaji tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    return {
      success: false,
      error: "Gagal menghapus gaji",
      code: "DELETE_ERROR",
    };
  }
}
