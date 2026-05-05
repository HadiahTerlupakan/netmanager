import { logger } from "@/lib/logger";
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
import {
  approveSalaryCommand,
  auditSalaryCommand,
  calculateBulkSalary,
  calculateSingleSalary,
  deleteSalaryCommand,
  markSalaryAsPaid,
  recalculateSalaryCommand,
} from "./SalaryService.commands";
import {
  addSalaryAdjustment,
  requestSalaryRevision,
  updateSalaryCommand,
} from "./SalaryService.adjustments";
import { asError, type ServiceResult } from "./SalaryService.helpers";

export class SalaryService {
  private readonly repository: ISalaryRepository;
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
    this.calculationCommandService = calculationCommandService;
    this.auditService = auditService;
    this.queryService = queryService;
    this.workflowService = workflowService;
  }

  private getCommandDependencies() {
    return {
      repository: this.repository,
      calculationCommandService: this.calculationCommandService,
      auditService: this.auditService,
      workflowService: this.workflowService,
    };
  }

  /** Get all salaries with filters and pagination. */
  async getSalaries(filters: SalaryFilters, page?: number, limit?: number) {
    try {
      return await this.queryService.getSalaries(filters, page, limit);
    } catch (error) {
      logger.error("SalaryService.getSalaries failed", asError(error));
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
      logger.error("SalaryService.getSalaryById failed", asError(error));
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
    return calculateSingleSalary(this.getCommandDependencies(), {
      userId,
      month,
      year,
      calculatedById,
    });
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
    return calculateBulkSalary(this.getCommandDependencies(), {
      month,
      year,
      filters,
      calculatedById,
    });
  }

  /** Approve salary. */
  async approveSalary(
    id: string,
    approvedById: string,
    notes?: string,
  ): Promise<ServiceResult<SalaryEntity>> {
    return approveSalaryCommand(this.getCommandDependencies(), {
      id,
      approvedById,
      notes,
    });
  }

  /** Mark salary as paid. */
  async markAsPaid(
    id: string,
    paidById: string,
    notes?: string,
  ): Promise<ServiceResult<SalaryEntity>> {
    return markSalaryAsPaid(this.getCommandDependencies(), {
      id,
      paidById,
      notes,
    });
  }

  /** Audit salary. */
  async auditSalary(
    id: string,
    auditedById: string,
    notes?: string,
  ): Promise<ServiceResult<SalaryEntity>> {
    return auditSalaryCommand(this.getCommandDependencies(), {
      id,
      auditedById,
      notes,
    });
  }

  /** Recalculate salary. */
  async recalculateSalary(
    id: string,
    recalculatedById: string,
  ): Promise<ServiceResult<{ salaryId: string }>> {
    return recalculateSalaryCommand(this.getCommandDependencies(), {
      id,
      recalculatedById,
    });
  }

  /** Delete salary. */
  async deleteSalary(
    id: string,
    deletedById: string,
  ): Promise<ServiceResult<void>> {
    return deleteSalaryCommand(this.getCommandDependencies(), {
      id,
      deletedById,
    });
  }

  /** Update salary metadata such as audit notes. */
  async updateSalary(
    id: string,
    data: { auditNotes?: string },
    updatedById: string,
  ): Promise<ServiceResult<SalaryEntity>> {
    return updateSalaryCommand(this.getCommandDependencies(), {
      id,
      data,
      updatedById,
    });
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
    return addSalaryAdjustment(this.getCommandDependencies(), {
      id,
      adjustment,
      adjustedById,
    });
  }

  /** Request salary revision. */
  async requestRevision(
    id: string,
    requestedById: string,
    reason: string,
  ): Promise<ServiceResult<void>> {
    return requestSalaryRevision(this.getCommandDependencies(), {
      id,
      requestedById,
      reason,
    });
  }
}

let salaryServiceInstance: SalaryService | null = null;

export function getSalaryService(): SalaryService {
  if (!salaryServiceInstance) {
    salaryServiceInstance = new SalaryService();
  }

  return salaryServiceInstance;
}
