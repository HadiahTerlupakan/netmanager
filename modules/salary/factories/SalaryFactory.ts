/**
 * SalaryFactory
 *
 * Factory pattern for creating Salary with different configurations.
 */

import { calculateSalaryTotals } from "../utils/salary-totals-calculator";
import { SalaryComponentRepository } from "../repositories/SalaryComponentRepository";
import { SalaryRepository } from "../repositories/SalaryRepository";

export interface CreateSalaryInput {
  userId: string;
  month: number;
  year: number;
  basicSalary: number;
  totalEarnings?: number;
  totalDeductions?: number;
  netSalary?: number;
}

const salaryComponentRepository = new SalaryComponentRepository();
const salaryRepository = new SalaryRepository();

export class SalaryFactory {
  /**
   * Create salary input for a specific period
   */
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
      totalEarnings: 0,
      totalDeductions: 0,
      netSalary: 0,
    };
  }

  /**
   * Create bulk salaries for all active employees
   */
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
      basicSalary: user.userSalaryComponents[0]?.amount ?? 0,
      totalEarnings: 0,
      totalDeductions: 0,
      netSalary: 0,
    }));
  }

  /**
   * Calculate salary details based on attendance, overtime, etc.
   */
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
