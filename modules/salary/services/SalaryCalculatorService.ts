import type { EmployeeType } from "../domain/entities/SalaryEntity";
import {
  calculateProratedBasicSalary,
  getPeriodDateRange,
  type UserCalculationData,
} from "../utils/salary-calculation-helpers";
export type { UserCalculationData } from "../utils/salary-calculation-helpers";
import type { ISalaryComponentRepository } from "../domain/ports/ISalaryComponentRepository";
import type { ISalaryRepository } from "../domain/ports/ISalaryRepository";
import { SalaryComponentRepository } from "../repositories/SalaryComponentRepository";
import { SalaryRepository } from "../repositories/SalaryRepository";
import {
  AttendancePayrollQueryService,
  LeaveBalanceQueryService,
} from "@/modules/attendance";
import { OvertimePayrollQueryService } from "@/modules/overtime";
import {
  UserRepository,
  EmployeeLoanRepository,
} from "../repositories/SalaryCalculationRepositories";
import { SalaryComponentCalculationService } from "./SalaryComponentCalculationService";
import { buildActiveLoanDeductionLines } from "./SalaryCalculatorService.helpers";
import { SalaryLoanDeductionService } from "./SalaryLoanDeductionService";
import { SalaryPayrollLineService } from "./SalaryPayrollLineService";
import { SalaryStatsQueryService } from "./SalaryStatsQueryService";

type SalaryCalculatorDependencies = {
  attendanceRepo?: AttendancePayrollQueryService;
  overtimeRepo?: OvertimePayrollQueryService;
  leaveBalanceRepo?: LeaveBalanceQueryService;
  userRepository?: UserRepository;
  employeeLoanRepository?: EmployeeLoanRepository;
  statsQueryService?: SalaryStatsQueryService;
  componentCalculationService?: SalaryComponentCalculationService;
  payrollLineService?: SalaryPayrollLineService;
  loanDeductionService?: SalaryLoanDeductionService;
};

interface SalaryCalculationResult {
  userId: string;
  month: number;
  year: number;
  basicSalary: number;
  earnings: Array<{
    name: string;
    amount: number;
    quantity?: number;
    rate?: number;
    notes?: string;
  }>;
  deductions: Array<{
    name: string;
    amount: number;
    quantity?: number;
    rate?: number;
    notes?: string;
    loanId?: string;
  }>;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
}

export class SalaryCalculatorService {
  private salaryRepo: ISalaryRepository;
  private componentRepo: ISalaryComponentRepository;
  private attendanceRepo: AttendancePayrollQueryService;
  private userRepository: UserRepository;
  private employeeLoanRepository: EmployeeLoanRepository;
  private statsQueryService: SalaryStatsQueryService;
  private componentCalculationService: SalaryComponentCalculationService;
  private payrollLineService: SalaryPayrollLineService;
  private loanDeductionService: SalaryLoanDeductionService;

  constructor(
    salaryRepo: ISalaryRepository = new SalaryRepository(),
    componentRepo: ISalaryComponentRepository = new SalaryComponentRepository(),
    dependencies: SalaryCalculatorDependencies = {},
  ) {
    this.salaryRepo = salaryRepo;
    this.componentRepo = componentRepo;
    this.attendanceRepo =
      dependencies.attendanceRepo ?? new AttendancePayrollQueryService();
    this.userRepository = dependencies.userRepository ?? new UserRepository();
    this.employeeLoanRepository =
      dependencies.employeeLoanRepository ?? new EmployeeLoanRepository();
    this.statsQueryService =
      dependencies.statsQueryService ?? new SalaryStatsQueryService();
    this.componentCalculationService =
      dependencies.componentCalculationService ??
      new SalaryComponentCalculationService();
    this.payrollLineService =
      dependencies.payrollLineService ?? new SalaryPayrollLineService();
    this.loanDeductionService =
      dependencies.loanDeductionService ?? new SalaryLoanDeductionService();
  }

  async calculateSalary(
    userId: string,
    month: number,
    year: number,
    existingUser?: UserCalculationData,
  ): Promise<SalaryCalculationResult> {
    const user = (existingUser ||
      (await this.userRepository.findSalaryData(
        userId,
      ))) as UserCalculationData | null;

    if (!user) {
      throw new Error(`User ${userId} tidak ditemukan`);
    }

    const userComponents = await this.componentRepo.getUserComponents(userId);

    if (!user.basicSalary) {
      throw new Error(`Gaji pokok untuk ${user.name || userId} belum diset`);
    }
    const basicSalary = user.basicSalary as number;

    const { startDate, endDate } = getPeriodDateRange({
      month,
      year,
      payPeriodDay: user.payPeriodDay ?? 25,
    });

    const payrollEvaluations =
      await this.attendanceRepo.findManyPayrollEvaluationsByUserAndDateRange({
        userId,
        startDate,
        endDate,
      });

    const statsInput = { userId, startDate, endDate, payrollEvaluations };
    const [attendanceStats, overtimeStats, woStats] = await Promise.all([
      this.statsQueryService.getAttendanceStats(statsInput),
      this.statsQueryService.getOvertimeStats(statsInput),
      this.statsQueryService.getWorkOrderStats({ userId, startDate, endDate }),
    ]);

    const earnings: SalaryCalculationResult["earnings"] = [];
    const deductions: SalaryCalculationResult["deductions"] = [];

    const { effectiveBasicSalary, isProrated } = calculateProratedBasicSalary({
      user,
      startDate,
      endDate,
      basicSalary,
      attendanceWorkDays: attendanceStats.workDays,
    });

    const payrollInput = {
      user,
      basicSalary,
      effectiveBasicSalary,
      attendanceStats,
      overtimeStats,
      workOrderStats: woStats,
    };
    earnings.push(...this.payrollLineService.buildEarningLines(payrollInput));

    const componentLines = this.componentCalculationService.buildComponentLines(
      {
        components: userComponents,
        user,
        effectiveBasicSalary,
        attendanceWorkDays: attendanceStats.workDays,
        isProrated,
        periodEndDate: endDate,
      },
    );
    earnings.push(...componentLines.earnings);
    deductions.push(...componentLines.deductions);

    deductions.push(
      ...this.payrollLineService.buildDeductionLines({
        ...payrollInput,
        earnings,
      }),
    );

    const activeLoans =
      await this.employeeLoanRepository.findActiveByUserId(userId);

    deductions.push(...buildActiveLoanDeductionLines(activeLoans));

    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netSalary = totalEarnings - totalDeductions;

    return {
      userId,
      month,
      year,
      basicSalary: basicSalary,
      earnings,
      deductions,
      totalEarnings,
      totalDeductions,
      netSalary,
    };
  }

  async calculateAndSave(
    userId: string,
    month: number,
    year: number,
    existingUser?: UserCalculationData,
  ): Promise<string> {
    const result = await this.calculateSalary(
      userId,
      month,
      year,
      existingUser,
    );

    const salary = await this.salaryRepo.upsert(userId, month, year, {
      basicSalary: result.basicSalary,
      totalEarnings: result.totalEarnings,
      totalDeductions: result.totalDeductions,
      netSalary: result.netSalary,
      status: "CALCULATED",
      calculatedAt: new Date(),
    });

    await this.loanDeductionService.resetExistingLoanPayments(salary.id);
    await this.salaryRepo.clearDetails(salary.id);

    for (const earning of result.earnings) {
      await this.salaryRepo.addDetail(salary.id, {
        name: earning.name,
        type: "EARNING",
        amount: earning.amount,
        quantity: earning.quantity,
        rate: earning.rate,
        notes: earning.notes,
      });
    }

    for (const deduction of result.deductions) {
      await this.loanDeductionService.createDeductionDetail(
        salary.id,
        deduction,
        {
          month,
          year,
        },
      );
    }

    return salary.id;
  }

  async calculateBulk(
    month: number,
    year: number,
    filters?: {
      departmentId?: string;
      siteId?: string;
      employeeType?: EmployeeType;
    },
  ): Promise<{
    success: number;
    failed: Array<{ userId: string; error: string }>;
  }> {
    const users =
      await this.userRepository.findActiveUsersWithBasicSalary(filters);

    let success = 0;
    const failed: Array<{ userId: string; error: string }> = [];

    for (const user of users) {
      try {
        await this.calculateAndSave(user.id, month, year, user);
        success++;
      } catch (error) {
        failed.push({
          userId: user.id,
          error: error instanceof Error ? error.message : "Terjadi kesalahan",
        });
      }
    }

    return { success, failed };
  }
}
