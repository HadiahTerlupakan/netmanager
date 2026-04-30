import { logger } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  EmployeeType,
  SalaryEntity,
} from "../domain/entities/SalaryEntity";
import type {
  ISalaryRepository,
  SalaryFilters,
} from "../domain/ports/ISalaryRepository";
import { SalaryRepository } from "../repositories/SalaryRepository";
import { SalaryAuditService } from "./SalaryAuditService";
import { SalaryCalculationCommandService } from "./SalaryCalculationCommandService";
import { SalaryCalculatorService } from "./SalaryCalculatorService";
import { SalaryQueryService } from "./SalaryQueryService";
import { SalaryWorkflowService } from "./SalaryWorkflowService";

import { logActivitySafe, type ServiceResult } from "./SalaryService.helpers";

export class SalaryService {
  private readonly repository: ISalaryRepository;
  private readonly calculatorService: SalaryCalculatorService;
  private readonly calculationCommandService: SalaryCalculationCommandService;
  private readonly auditService: SalaryAuditService;
  private readonly queryService: SalaryQueryService;
  private readonly workflowService: SalaryWorkflowService;

  constructor(
    repository: ISalaryRepository = new SalaryRepository(),
    calculatorService: SalaryCalculatorService = new SalaryCalculatorService(),
    auditService: SalaryAuditService = new SalaryAuditService(repository),
    workflowService: SalaryWorkflowService = new SalaryWorkflowService(
      repository,
    ),
    queryService: SalaryQueryService = new SalaryQueryService(repository),
    calculationCommandService: SalaryCalculationCommandService = new SalaryCalculationCommandService(
      calculatorService,
      workflowService,
    ),
  ) {
    this.repository = repository;
    this.calculatorService = calculatorService;
    this.calculationCommandService = calculationCommandService;
    this.auditService = auditService;
    this.queryService = queryService;
    this.workflowService = workflowService;
  }

  /** Get all salaries with filters and pagination. */
  async getSalaries(filters: SalaryFilters, page?: number, limit?: number) {
    try {
      return await this.queryService.getSalaries(filters, page, limit);
    } catch (error) {
      logger.error("SalaryService.getSalaries failed", this.asError(error));
      return {
        success: false,
        error: "Gagal mengambil data gaji",
        code: "FETCH_ERROR",
      };
    }
  }

  /** Get single salary by ID. */
  async getSalaryById(id: string) {
    try {
      return await this.queryService.getSalaryById(id);
    } catch (error) {
      logger.error("SalaryService.getSalaryById failed", this.asError(error));
      return {
        success: false,
        error: "Gagal mengambil gaji",
        code: "FETCH_ERROR",
      };
    }
  }

  /** Calculate salary for single user. */
  async calculateSingle(
    userId: string,
    month: number,
    year: number,
    calculatedById: string,
  ): Promise<ServiceResult<{ salaryId: string }>> {
    try {
      const { salaryId } = await this.calculationCommandService.calculateSingle(
        {
          userId,
          month,
          year,
        },
      );
      this.logActivity("CREATE", calculatedById, {
        salaryId,
        userId,
        month,
        year,
        action: "calculate-single",
      });
      return { success: true, data: { salaryId } };
    } catch (error) {
      logger.error("SalaryService.calculateSingle failed", this.asError(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : "Gagal menghitung gaji",
        code: "CALCULATION_ERROR",
      };
    }
  }

  /** Bulk calculate salaries. */
  async calculateBulk(
    month: number,
    year: number,
    filters: {
      departmentId?: string;
      siteId?: string;
      employeeType?: EmployeeType;
    },
    calculatedById: string,
  ): Promise<
    ServiceResult<{
      success: number;
      failed: Array<{ userId: string; error: string }>;
    }>
  > {
    try {
      const result = await this.calculationCommandService.calculateBulk({
        month,
        year,
        filters,
      });
      this.logActivity("CREATE", calculatedById, {
        month,
        year,
        action: "calculate-bulk",
        successCount: result.success,
        failedCount: result.failed.length,
        filters,
      });
      return { success: true, data: result };
    } catch (error) {
      logger.error("SalaryService.calculateBulk failed", this.asError(error));
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menghitung gaji massal",
        code: "BULK_CALCULATION_ERROR",
      };
    }
  }

  /** Approve salary. */
  async approveSalary(
    id: string,
    approvedById: string,
    notes?: string,
  ): Promise<ServiceResult<SalaryEntity>> {
    try {
      const result = await this.workflowService.approveSalary({
        id,
        actorId: approvedById,
        notes,
      });
      if (!result.success) return result;

      this.logActivity("UPDATE", approvedById, {
        id,
        status: "APPROVED",
        notes,
      });
      return result;
    } catch (error) {
      logger.error("SalaryService.approveSalary failed", this.asError(error));
      return {
        success: false,
        error: "Gagal menyetujui gaji",
        code: "APPROVE_ERROR",
      };
    }
  }

  /** Mark salary as paid. */
  async markAsPaid(
    id: string,
    paidById: string,
    notes?: string,
  ): Promise<ServiceResult<SalaryEntity>> {
    try {
      const result = await this.workflowService.markAsPaid({
        id,
        actorId: paidById,
        notes,
      });
      if (!result.success) return result;

      this.logActivity("UPDATE", paidById, { id, status: "PAID", notes });
      return result;
    } catch (error) {
      logger.error("SalaryService.markAsPaid failed", this.asError(error));
      return {
        success: false,
        error: "Gagal menandai gaji sebagai dibayar",
        code: "PAID_ERROR",
      };
    }
  }

  /** Audit salary. */
  async auditSalary(
    id: string,
    auditedById: string,
    notes?: string,
  ): Promise<ServiceResult<SalaryEntity>> {
    try {
      const result = await this.workflowService.auditSalary({
        id,
        actorId: auditedById,
        notes,
      });
      if (!result.success) return result;

      this.logActivity("UPDATE", auditedById, { id, status: "AUDITED", notes });
      return result;
    } catch (error) {
      logger.error("SalaryService.auditSalary failed", this.asError(error));
      return {
        success: false,
        error: "Gagal mengaudit gaji",
        code: "AUDIT_ERROR",
      };
    }
  }

  /** Recalculate salary. */
  async recalculateSalary(
    id: string,
    recalculatedById: string,
  ): Promise<ServiceResult<{ salaryId: string }>> {
    try {
      const result = await this.calculationCommandService.recalculateSalary(id);
      if (!result.success) return result;

      this.logActivity("UPDATE", recalculatedById, {
        id,
        salaryId: result.data.salaryId,
        action: "recalculate",
        previousStatus: result.data.previousStatus,
      });
      return { success: true, data: { salaryId: result.data.salaryId } };
    } catch (error) {
      logger.error(
        "SalaryService.recalculateSalary failed",
        this.asError(error),
      );
      return {
        success: false,
        error: "Gagal menghitung ulang gaji",
        code: "RECALCULATE_ERROR",
      };
    }
  }

  /** Delete salary. */
  async deleteSalary(
    id: string,
    deletedById: string,
  ): Promise<ServiceResult<void>> {
    try {
      const result = await this.workflowService.deleteDraft(id);
      if (!result.success) return this.withoutData(result);

      this.logActivity("DELETE", deletedById, {
        id,
        userId: result.data.userId,
        month: result.data.month,
        year: result.data.year,
      });
      return { success: true };
    } catch (error) {
      logger.error("SalaryService.deleteSalary failed", this.asError(error));
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

  /** Update salary metadata such as audit notes. */
  async updateSalary(
    id: string,
    data: { auditNotes?: string },
    updatedById: string,
  ): Promise<ServiceResult<SalaryEntity>> {
    try {
      const result = await this.workflowService.updateCalculatedSalary({
        id,
        data,
      });
      if (!result.success) return result;

      this.logActivity("UPDATE", updatedById, {
        id,
        updatedFields: Object.keys(data),
      });
      return result;
    } catch (error) {
      logger.error("SalaryService.updateSalary failed", this.asError(error));
      return {
        success: false,
        error: "Gagal mengupdate gaji",
        code: "UPDATE_ERROR",
      };
    }
  }

  /** Add manual adjustment to salary. */
  async addAdjustment(
    id: string,
    adjustment: {
      name: string;
      type: "EARNING" | "DEDUCTION";
      amount: number;
      notes: string;
    },
    adjustedById: string,
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Gaji tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      await this.auditService.addManualAdjustment(
        id,
        adjustment.name,
        adjustment.type,
        adjustment.amount,
        adjustment.notes,
        adjustedById,
      );
      this.logActivity("UPDATE", adjustedById, {
        id,
        action: "add-adjustment",
        adjustment,
      });
      return { success: true };
    } catch (error) {
      logger.error("SalaryService.addAdjustment failed", this.asError(error));
      return {
        success: false,
        error: "Gagal menambah penyesuaian",
        code: "ADJUSTMENT_ERROR",
      };
    }
  }

  /** Request salary revision. */
  async requestRevision(
    id: string,
    requestedById: string,
    reason: string,
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Gaji tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      await this.auditService.requestRevision(id, requestedById, reason);
      this.logActivity("UPDATE", requestedById, {
        id,
        action: "request-revision",
        reason,
      });
      return { success: true };
    } catch (error) {
      logger.error("SalaryService.requestRevision failed", this.asError(error));
      return {
        success: false,
        error: "Gagal meminta revisi",
        code: "REVISION_ERROR",
      };
    }
  }

  /** Log salary activity safely. */
  private logActivity(
    action: string,
    userId: string,
    details: Record<string, unknown>,
  ): void {
    logActivitySafe({ action, subject: "Salary", userId, details });
  }

  /** Convert failed service result to another generic payload. */
  private withoutData<T>(result: ServiceResult<T>): ServiceResult<never> {
    return {
      success: false,
      error: result.success ? "Terjadi kesalahan" : result.error,
      code: result.success ? "UNKNOWN_ERROR" : result.code,
    };
  }

  /** Convert unknown error into Error when possible. */
  private asError(error: unknown): Error | undefined {
    return error instanceof Error ? error : undefined;
  }
}

let salaryServiceInstance: SalaryService | null = null;

export function getSalaryService(): SalaryService {
  if (!salaryServiceInstance) {
    salaryServiceInstance = new SalaryService();
  }

  return salaryServiceInstance;
}
