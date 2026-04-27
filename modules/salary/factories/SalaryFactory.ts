import type { ISalaryComponentRepository } from "../domain/ports/ISalaryComponentRepository";
import type { ISalaryRepository } from "../domain/ports/ISalaryRepository";
import { SalaryComponentRepository } from "../repositories/SalaryComponentRepository";
import { SalaryRepository } from "../repositories/SalaryRepository";
import { calculateSalaryTotals } from "../utils/salary-totals-calculator";

const DEFAULT_TOTAL = 0;

export interface CreateSalaryInput {
  userId: string;
  month: number;
  year: number;
  basicSalary: number;
  totalEarnings?: number;
  totalDeductions?: number;
  netSalary?: number;
}

const salaryComponentRepository: ISalaryComponentRepository =
  new SalaryComponentRepository();
const salaryRepository: ISalaryRepository = new SalaryRepository();

export class SalaryFactory {
  /** Create salary input for a specific period. */
  static async createForPeriod(dto: {
    userId: string;
    month: number;
    year: number;
  }): Promise<CreateSalaryInput> {
    const basicSalary = await salaryComponentRepository.findBasicSalaryAmount(
      dto.userId,
    );

    return {
      userId: dto.userId,
      month: dto.month,
      year: dto.year,
      basicSalary,
      totalEarnings: DEFAULT_TOTAL,
      totalDeductions: DEFAULT_TOTAL,
      netSalary: DEFAULT_TOTAL,
    };
  }

  /** Create bulk salary inputs for active employees. */
  static async createBulkForPeriod(dto: {
    month: number;
    year: number;
    userIds?: string[];
  }): Promise<CreateSalaryInput[]> {
    const users =
      await salaryComponentRepository.findActiveUsersWithBasicSalaryComponent(
        dto.userIds,
      );

    return users.map((user) => ({
      userId: user.id,
      month: dto.month,
      year: dto.year,
      basicSalary: user.basicSalaryAmount,
      totalEarnings: DEFAULT_TOTAL,
      totalDeductions: DEFAULT_TOTAL,
      netSalary: DEFAULT_TOTAL,
    }));
  }

  /** Calculate salary totals from stored details. */
  static async calculateDetails(salaryId: string): Promise<{
    totalEarnings: number;
    totalDeductions: number;
    netSalary: number;
  }> {
    const salary = await salaryRepository.findByIdWithDetailsOnly(salaryId);

    if (!salary) {
      throw new Error("Salary not found");
    }

    return calculateSalaryTotals(salary.details, salary.basicSalary);
  }
}
