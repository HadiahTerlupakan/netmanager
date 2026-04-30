import type { EmployeeType } from "../domain/entities/SalaryEntity";
import { SalaryCalculatorService } from "./SalaryCalculatorService";
import { SalaryWorkflowService } from "./SalaryWorkflowService";
import type { ServiceResult } from "./SalaryService.helpers";

/** Mengelola command kalkulasi salary tunggal, bulk, dan recalculation. */
export class SalaryCalculationCommandService {
  constructor(
    private readonly calculatorService = new SalaryCalculatorService(),
    private readonly workflowService = new SalaryWorkflowService(),
  ) {}

  /** Hitung salary untuk satu user dan simpan hasilnya. */
  async calculateSingle(input: SalarySingleCalculationInput) {
    const salaryId = await this.calculatorService.calculateAndSave(
      input.userId,
      input.month,
      input.year,
    );
    return { salaryId };
  }

  /** Hitung salary untuk banyak user sesuai filter. */
  async calculateBulk(input: SalaryBulkCalculationInput) {
    return this.calculatorService.calculateBulk(
      input.month,
      input.year,
      input.filters,
    );
  }

  /** Hitung ulang salary yang statusnya masih valid untuk recalculation. */
  async recalculateSalary(
    id: string,
  ): Promise<ServiceResult<{ salaryId: string; previousStatus: string }>> {
    const existingResult =
      await this.workflowService.getRecalculatableSalary(id);
    if (!existingResult.success) {
      return {
        success: false,
        error: existingResult.error,
        code: existingResult.code,
      };
    }

    const existing = existingResult.data;
    const salaryId = await this.calculatorService.calculateAndSave(
      existing.userId,
      existing.month,
      existing.year,
    );

    return {
      success: true,
      data: { salaryId, previousStatus: existing.status },
    };
  }
}

type SalarySingleCalculationInput = {
  userId: string;
  month: number;
  year: number;
};

type SalaryBulkCalculationInput = {
  month: number;
  year: number;
  filters: {
    departmentId?: string;
    siteId?: string;
    employeeType?: EmployeeType;
  };
};
