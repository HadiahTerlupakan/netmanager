import { logger } from "@/lib/logger";
import type { SalaryEntity } from "../domain/entities/SalaryEntity";
import type { ISalaryRepository } from "../domain/ports/ISalaryRepository";
import { SalaryAuditService } from "./SalaryAuditService";
import { SalaryCalculationCommandService } from "./SalaryCalculationCommandService";
import {
  asError,
  buildSalaryUpdatePayload,
  logSalaryActivity,
  type ServiceResult,
} from "./SalaryService.helpers";
import { SalaryWorkflowService } from "./SalaryWorkflowService";

type SalaryCommandDependencies = {
  repository: ISalaryRepository;
  calculationCommandService: SalaryCalculationCommandService;
  auditService: SalaryAuditService;
  workflowService: SalaryWorkflowService;
};

export async function updateSalaryCommand(
  deps: SalaryCommandDependencies,
  input: {
    id: string;
    data: { auditNotes?: string };
    updatedById: string;
  },
): Promise<ServiceResult<SalaryEntity>> {
  try {
    const result = await deps.workflowService.updateCalculatedSalary({
      id: input.id,
      data: buildSalaryUpdatePayload(input.data),
    });
    if (!result.success) {
      return result;
    }

    logSalaryActivity("UPDATE", input.updatedById, {
      id: input.id,
      updatedFields: Object.keys(input.data),
    });
    return result;
  } catch (error) {
    logger.error("SalaryService.updateSalary failed", asError(error));
    return {
      success: false,
      error: "Gagal mengupdate gaji",
      code: "UPDATE_ERROR",
    };
  }
}

export async function addSalaryAdjustment(
  deps: SalaryCommandDependencies,
  input: {
    id: string;
    adjustment: {
      name: string;
      type: "EARNING" | "DEDUCTION";
      amount: number;
      notes: string;
    };
    adjustedById: string;
  },
): Promise<ServiceResult<void>> {
  try {
    const existing = await deps.repository.findById(input.id);
    if (!existing) {
      return {
        success: false,
        error: "Gaji tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    await deps.auditService.addManualAdjustment(
      input.id,
      input.adjustment.name,
      input.adjustment.type,
      input.adjustment.amount,
      input.adjustment.notes,
      input.adjustedById,
    );
    logSalaryActivity("UPDATE", input.adjustedById, {
      id: input.id,
      action: "add-adjustment",
      adjustment: input.adjustment,
    });
    return { success: true };
  } catch (error) {
    logger.error("SalaryService.addAdjustment failed", asError(error));
    return {
      success: false,
      error: "Gagal menambah penyesuaian",
      code: "ADJUSTMENT_ERROR",
    };
  }
}

export async function requestSalaryRevision(
  deps: SalaryCommandDependencies,
  input: { id: string; requestedById: string; reason: string },
): Promise<ServiceResult<void>> {
  try {
    const existing = await deps.repository.findById(input.id);
    if (!existing) {
      return {
        success: false,
        error: "Gaji tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    await deps.auditService.requestRevision(
      input.id,
      input.requestedById,
      input.reason,
    );
    logSalaryActivity("UPDATE", input.requestedById, {
      id: input.id,
      action: "request-revision",
      reason: input.reason,
    });
    return { success: true };
  } catch (error) {
    logger.error("SalaryService.requestRevision failed", asError(error));
    return {
      success: false,
      error: "Gagal meminta revisi",
      code: "REVISION_ERROR",
    };
  }
}

export type { SalaryCommandDependencies };
