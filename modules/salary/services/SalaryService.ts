import { logger } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  EmployeeType,
  SalaryEntity,
  SalaryWithDetailsEntity,
} from "../domain/entities/SalaryEntity";
import type {
  ISalaryRepository,
  SalaryFilters,
} from "../domain/ports/ISalaryRepository";
import { SalaryRepository } from "../repositories/SalaryRepository";
import { SalaryAuditService } from "./SalaryAuditService";
import { SalaryCalculatorService } from "./SalaryCalculatorService";

import {
  logActivitySafe,
  type SalaryListResult,
  type ServiceResult,
  type UpdateSalaryInput,
} from "./SalaryService.helpers";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

export class SalaryService {
  private readonly repository: ISalaryRepository;
  private readonly calculatorService: SalaryCalculatorService;
  private readonly auditService: SalaryAuditService;

  constructor(
    repository: ISalaryRepository = new SalaryRepository(),
    calculatorService: SalaryCalculatorService = new SalaryCalculatorService(),
    auditService: SalaryAuditService = new SalaryAuditService(repository),
  ) {
    this.repository = repository;
    this.calculatorService = calculatorService;
    this.auditService = auditService;
  }

  /** Get all salaries with filters and pagination. */
  async getSalaries(
    filters: SalaryFilters,
    page: number = DEFAULT_PAGE,
    limit: number = DEFAULT_LIMIT,
  ): Promise<ServiceResult<SalaryListResult>> {
    try {
      const skip = (page - 1) * limit;
      const result = await this.repository.findAll({
        ...filters,
        skip,
        take: limit,
      });
      const stats = await this.getPeriodStats(filters);

      return {
        success: true,
        data: {
          salaries: result.salaries,
          total: result.total,
          page,
          totalPages: Math.ceil(result.total / limit),
          stats,
        },
      };
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
  async getSalaryById(
    id: string,
  ): Promise<ServiceResult<SalaryWithDetailsEntity>> {
    try {
      const salary = await this.repository.findById(id);

      if (!salary) {
        return {
          success: false,
          error: "Gaji tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      return { success: true, data: salary };
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
      const salaryId = await this.calculatorService.calculateAndSave(
        userId,
        month,
        year,
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
      const result = await this.calculatorService.calculateBulk(
        month,
        year,
        filters,
      );
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
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Gaji tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (existing.status !== "AUDITED") {
        return {
          success: false,
          error: "Gaji harus diaudit sebelum disetujui",
          code: "INVALID_STATUS",
        };
      }

      const salary = await this.repository.updateStatus(
        id,
        "APPROVED",
        approvedById,
        notes,
      );
      this.logActivity("UPDATE", approvedById, {
        id,
        status: "APPROVED",
        previousStatus: existing.status,
        notes,
      });
      return { success: true, data: salary };
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
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Gaji tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (existing.status !== "APPROVED") {
        return {
          success: false,
          error: "Gaji harus disetujui sebelum ditandai dibayar",
          code: "INVALID_STATUS",
        };
      }

      const salary = await this.repository.updateStatus(
        id,
        "PAID",
        paidById,
        notes,
      );
      this.logActivity("UPDATE", paidById, {
        id,
        status: "PAID",
        previousStatus: existing.status,
        notes,
      });
      return { success: true, data: salary };
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
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Gaji tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (existing.status !== "CALCULATED") {
        return {
          success: false,
          error: "Gaji harus dihitung sebelum diaudit",
          code: "INVALID_STATUS",
        };
      }

      const salary = await this.repository.updateStatus(
        id,
        "AUDITED",
        auditedById,
        notes,
      );
      this.logActivity("UPDATE", auditedById, {
        id,
        status: "AUDITED",
        previousStatus: existing.status,
        notes,
      });
      return { success: true, data: salary };
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
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Gaji tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (!["DRAFT", "CALCULATED"].includes(existing.status)) {
        return {
          success: false,
          error:
            "Hanya gaji draft atau yang sudah dihitung yang dapat dihitung ulang",
          code: "INVALID_STATUS",
        };
      }

      await this.repository.clearDetails(id);
      const salaryId = await this.calculatorService.calculateAndSave(
        existing.userId,
        existing.month,
        existing.year,
      );
      this.logActivity("UPDATE", recalculatedById, {
        id,
        salaryId,
        action: "recalculate",
        previousStatus: existing.status,
      });
      return { success: true, data: { salaryId } };
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
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Gaji tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (existing.status !== "DRAFT") {
        return {
          success: false,
          error: "Hanya gaji draft yang dapat dihapus",
          code: "INVALID_STATUS",
        };
      }

      await this.repository.delete(id);
      this.logActivity("DELETE", deletedById, {
        id,
        userId: existing.userId,
        month: existing.month,
        year: existing.year,
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
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Gaji tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (!["CALCULATED", "REVISED"].includes(existing.status)) {
        return {
          success: false,
          error: `Tidak dapat mengubah gaji dengan status: ${existing.status}`,
          code: "INVALID_STATUS",
        };
      }

      const updateData: UpdateSalaryInput = {};
      if (data.auditNotes !== undefined) {
        updateData.auditNotes = data.auditNotes;
      }

      const salary = await this.repository.update(id, updateData);
      this.logActivity("UPDATE", updatedById, {
        id,
        updatedFields: Object.keys(updateData),
        previousStatus: existing.status,
      });
      return { success: true, data: salary };
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

  /** Load period stats when filter has month and year. */
  private async getPeriodStats(filters: SalaryFilters) {
    if (!filters.month || !filters.year) {
      return undefined;
    }

    return this.repository.getPeriodStats(filters.month, filters.year);
  }

  /** Log salary activity safely. */
  private logActivity(
    action: string,
    userId: string,
    details: Record<string, unknown>,
  ): void {
    logActivitySafe({ action, subject: "Salary", userId, details });
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
