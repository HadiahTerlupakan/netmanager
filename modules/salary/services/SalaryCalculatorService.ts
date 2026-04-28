import type { EmployeeType } from "../domain/entities/SalaryEntity";
import {
  applyAttendanceStatus,
  applyOvertimeMinutes,
  calculateOvertimePay,
  calculatePph21Ter,
  calculateProratedBasicSalary,
  calculateWorkDays,
  createAttendanceStats,
  createOvertimeStats,
  createPayrollEvaluationMap,
  getDateKey,
  getDefaultWorkDaysString,
  getPeriodDateRange,
  isNationalHolidayState,
  type AttendanceStats,
  type OvertimeStats,
  type PayrollEvaluationSummary,
  type UserCalculationData,
} from "../utils/salary-calculation-helpers";
export type { UserCalculationData } from "../utils/salary-calculation-helpers";
import type { ISalaryComponentRepository } from "../domain/ports/ISalaryComponentRepository";
import type { ISalaryRepository } from "../domain/ports/ISalaryRepository";
import { SalaryComponentRepository } from "../repositories/SalaryComponentRepository";
import { SalaryRepository } from "../repositories/SalaryRepository";
import { AttendanceRepository } from "@/modules/attendance/repositories/AttendanceRepository";
import { LeaveBalanceRepository } from "@/modules/attendance/repositories/LeaveBalanceRepository";
import { OvertimeRepository } from "@/modules/overtime/repositories/OvertimeRepository";
import {
  UserRepository,
  EmployeeLoanRepository,
  AttendanceRepositoryForSalary,
  OvertimeRepositoryForSalary,
  WorkOrderRepositoryForSalary,
  SalaryDetailRepository,
  runTransaction,
} from "../repositories/SalaryCalculationRepositories";

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
  private attendanceRepo: AttendanceRepository;
  private overtimeRepo: OvertimeRepository;
  private leaveBalanceRepo: LeaveBalanceRepository;
  private userRepository: UserRepository;
  private employeeLoanRepository: EmployeeLoanRepository;
  private attendanceRepoForSalary: AttendanceRepositoryForSalary;
  private overtimeRepoForSalary: OvertimeRepositoryForSalary;
  private workOrderRepoForSalary: WorkOrderRepositoryForSalary;
  private salaryDetailRepository: SalaryDetailRepository;

  constructor(
    salaryRepo: ISalaryRepository = new SalaryRepository(),
    componentRepo: ISalaryComponentRepository = new SalaryComponentRepository(),
  ) {
    this.salaryRepo = salaryRepo;
    this.componentRepo = componentRepo;
    this.attendanceRepo = new AttendanceRepository();
    this.overtimeRepo = new OvertimeRepository();
    this.leaveBalanceRepo = new LeaveBalanceRepository();
    this.userRepository = new UserRepository();
    this.employeeLoanRepository = new EmployeeLoanRepository();
    this.attendanceRepoForSalary = new AttendanceRepositoryForSalary();
    this.overtimeRepoForSalary = new OvertimeRepositoryForSalary();
    this.workOrderRepoForSalary = new WorkOrderRepositoryForSalary();
    this.salaryDetailRepository = new SalaryDetailRepository();
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

    const [attendanceStats, overtimeStats, woStats] = await Promise.all([
      this.getAttendanceStats(userId, startDate, endDate, payrollEvaluations),
      this.getOvertimeStats(userId, startDate, endDate, payrollEvaluations),
      this.getWorkOrderStats(userId, startDate, endDate),
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

    earnings.push({
      name: "Gaji Pokok",
      amount: effectiveBasicSalary,
      notes:
        isProrated && effectiveBasicSalary > 0
          ? "Prorate (karyawan baru)"
          : undefined,
    });

    for (const uc of userComponents) {
      let amount = uc.amount;
      let rate: number | undefined = undefined;

      if (uc.component.rateType === "PERCENTAGE") {
        amount = Math.round((effectiveBasicSalary * uc.amount) / 100);
        rate = uc.amount;
      } else if (
        isProrated &&
        effectiveBasicSalary > 0 &&
        uc.component.type === "EARNING"
      ) {
        const workDaysSinceJoin = calculateWorkDays(
          user.joinDate!,
          endDate,
          user.workDays || getDefaultWorkDaysString(),
        );
        amount = Math.round(
          (uc.amount / attendanceStats.workDays) * workDaysSinceJoin,
        );
      } else if (isProrated && effectiveBasicSalary === 0) {
        amount = 0;
      }

      if (uc.component.type === "EARNING") {
        earnings.push({
          name: uc.component.name,
          amount: Math.round(amount),
          rate: rate,
          notes: uc.notes || undefined,
        });
      } else {
        deductions.push({
          name: uc.component.name,
          amount: Math.round(amount),
          rate: rate,
          notes: uc.notes || undefined,
        });
      }
    }

    if (overtimeStats.totalMinutes > 0) {
      const effectiveOtRateType = user.overtimeCalcTypeNormal;
      const effectiveOtRateNormal = user.overtimeRateNormal || 0;
      const effectiveOtRateHoliday = user.overtimeRateHoliday || 0;
      const effectiveOtRateNational = user.overtimeRateNational || 0;

      const overtimePay = calculateOvertimePay({
        stats: overtimeStats,
        rateType: effectiveOtRateType,
        rateNormal: effectiveOtRateNormal,
        rateHoliday: effectiveOtRateHoliday,
        rateNational: effectiveOtRateNational,
        basicSalary,
        workDays: attendanceStats.workDays,
      });
      if (overtimePay.amount > 0) {
        earnings.push({
          name: "Lembur",
          amount: Math.round(overtimePay.amount),
          quantity: Number(overtimePay.hours.toFixed(1)),
          rate: Math.round(overtimePay.rate),
          notes: `Total ${overtimePay.hours.toFixed(1)} jam`,
        });
      }
    }

    if (user.woIncentiveEnabled && woStats.completed > 0) {
      const effectiveWoRate = user.woIncentiveRate || 0;
      const woIncentive = Math.round(woStats.completed * effectiveWoRate);
      earnings.push({
        name: "Insentif WO",
        amount: woIncentive,
        quantity: woStats.completed,
        rate: effectiveWoRate,
        notes: `${woStats.completed} WO selesai`,
      });
    }

    if (attendanceStats.late > 0) {
      const effectiveLateRate = user.lateDeductionRate || 0;
      const lateDeduction = Math.round(
        attendanceStats.late * effectiveLateRate,
      );
      deductions.push({
        name: "Potongan Telat",
        amount: lateDeduction,
        quantity: attendanceStats.late,
        rate: effectiveLateRate,
        notes: `${attendanceStats.late} hari telat`,
      });
    }

    if (
      attendanceStats.absent > 0 ||
      attendanceStats.sick > 0 ||
      attendanceStats.permit > 0
    ) {
      const deductionPerDay = Math.round(
        effectiveBasicSalary / attendanceStats.workDays,
      );
      let absentDeduction = deductionPerDay * attendanceStats.absent;

      if (
        user.absentDeductionRate &&
        user.absentDeductionRate > deductionPerDay
      ) {
        absentDeduction = user.absentDeductionRate * attendanceStats.absent;
      }

      if (absentDeduction > 0) {
        deductions.push({
          name: "Potongan Alpha / Unpaid",
          amount: absentDeduction,
          quantity: attendanceStats.absent,
          rate: Math.max(deductionPerDay, user.absentDeductionRate || 0),
          notes: `${attendanceStats.absent} hari absen/unpaid`,
        });
      }
    }

    if (attendanceStats.sick > 0) {
      earnings.push({
        name: "Sakit",
        amount: 0,
        quantity: attendanceStats.sick,
        notes: `${attendanceStats.sick} hari (Informasi)`,
      });
    }
    if (attendanceStats.permit > 0) {
      earnings.push({
        name: "Izin",
        amount: 0,
        quantity: attendanceStats.permit,
        notes: `${attendanceStats.permit} hari (Informasi)`,
      });
    }

    const bpjsBaseSalary = earnings
      .filter((e) => e.name === "Gaji Pokok" || e.rate !== undefined)
      .reduce((sum, e) => sum + e.amount, 0);

    if (user.bpjsKesehatan) {
      const baseKes = Math.min(12000000, bpjsBaseSalary);
      const bpjsKesAmount = Math.round(baseKes * 0.01);
      deductions.push({
        name: "BPJS Kesehatan (1%)",
        amount: bpjsKesAmount,
        notes: `Batas max Rp12jt`,
      });
    }

    if (user.bpjsKetenagakerjaan) {
      const bpjsJhtAmount = Math.round(bpjsBaseSalary * 0.02);
      const baseJp = Math.min(10042300, bpjsBaseSalary);
      const bpjsJpAmount = Math.round(baseJp * 0.01);

      deductions.push({
        name: "BPJS JHT (2%)",
        amount: bpjsJhtAmount,
      });
      deductions.push({
        name: "BPJS Pensiun (1%)",
        amount: bpjsJpAmount,
        notes: `Batas max Rp10jt`,
      });
    }

    const activeLoans =
      await this.employeeLoanRepository.findActiveByUserId(userId);

    for (const loan of activeLoans) {
      if (loan.remainingAmount > 0) {
        const deductionAmount = Math.min(
          loan.installment,
          loan.remainingAmount,
        );

        deductions.push({
          name: "Cicilan Pinjaman",
          amount: deductionAmount,
          loanId: loan.id,
          notes: `Sisa sebelum dipotong: Rp${loan.remainingAmount.toLocaleString()}`,
        });
      }
    }

    const grossIncome = earnings.reduce((sum, e) => sum + e.amount, 0);
    if (user.ptkpStatus && grossIncome > 0) {
      const pph21Amount = calculatePph21Ter(grossIncome, user.ptkpStatus);
      if (pph21Amount > 0) {
        deductions.push({
          name: "Pajak PPh 21 (TER)",
          amount: pph21Amount,
          notes: `Status PTKP: ${user.ptkpStatus.replace("_", "/")}`,
        });
      }
    }

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

    const existingDetailsWithLoans =
      await this.salaryDetailRepository.findManyWithLoanPayment(salary.id);

    for (const detail of existingDetailsWithLoans) {
      if (detail.loanPayment) {
        await runTransaction(async (tx) => {
          const loan = await this.employeeLoanRepository.findUnique(
            detail.loanPayment!.loanId,
          );
          if (loan) {
            const newRemaining =
              loan.remainingAmount + detail.loanPayment!.amount;
            await this.employeeLoanRepository.updateInTransaction(tx, loan.id, {
              remainingAmount: newRemaining,
              status: "ACTIVE",
            });
          }
          await this.employeeLoanRepository.deleteLoanPaymentInTransaction(
            tx,
            detail.loanPaymentId!,
          );
        });
      }
    }

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
      let loanPaymentId: string | undefined = undefined;

      if (deduction.loanId) {
        loanPaymentId = await runTransaction(async (tx) => {
          const loan = await this.employeeLoanRepository.findUnique(
            deduction.loanId!,
          );
          if (!loan) return undefined;

          const newRemaining = Math.max(
            0,
            loan.remainingAmount - deduction.amount,
          );
          const newStatus = newRemaining <= 0 ? "PAID_OFF" : "ACTIVE";

          await this.employeeLoanRepository.updateInTransaction(tx, loan.id, {
            remainingAmount: newRemaining,
            status: newStatus,
          });

          const payment =
            await this.employeeLoanRepository.createLoanPaymentInTransaction(
              tx,
              {
                loan: { connect: { id: loan.id } },
                amount: deduction.amount,
                notes: `Potongan gaji otomatis bulan ${month}/${year}`,
              },
            );
          return payment.id;
        });
      }

      await this.salaryDetailRepository.createWithLoanPayment({
        salary: { connect: { id: salary.id } },
        name: deduction.name,
        type: "DEDUCTION",
        amount: deduction.amount,
        quantity: deduction.quantity,
        rate: deduction.rate,
        notes: deduction.notes,
        ...(loanPaymentId && {
          loanPayment: { connect: { id: loanPaymentId } },
        }),
      });
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

  private async getAttendanceStats(
    userId: string,
    startDate: Date,
    endDate: Date,
    payrollEvaluations: PayrollEvaluationSummary[],
  ): Promise<AttendanceStats> {
    const [attendances, userWorkDays] = await Promise.all([
      this.attendanceRepoForSalary.findByUserAndDateRange(
        userId,
        startDate,
        endDate,
      ),
      this.userRepository.findWorkDays(userId),
    ]);

    const workDays = calculateWorkDays(
      startDate,
      endDate,
      userWorkDays?.workDays || getDefaultWorkDaysString(),
    );

    const stats = createAttendanceStats(workDays);
    const evaluationMap = createPayrollEvaluationMap(payrollEvaluations);
    const processedDateKeys = new Set<string>();

    for (const attendance of attendances) {
      const dateKey = getDateKey(attendance.checkIn);
      const evaluation = dateKey ? evaluationMap.get(dateKey) : undefined;
      const status = evaluation?.finalStatus ?? attendance.status;

      applyAttendanceStatus(stats, status);

      if (dateKey) {
        processedDateKeys.add(dateKey);
      }
    }

    for (const evaluation of payrollEvaluations) {
      const dateKey = getDateKey(evaluation.workDate);
      if (!dateKey || processedDateKeys.has(dateKey)) {
        continue;
      }

      applyAttendanceStatus(stats, evaluation.finalStatus);
    }

    return stats;
  }

  private async getOvertimeStats(
    userId: string,
    startDate: Date,
    endDate: Date,
    payrollEvaluations: PayrollEvaluationSummary[],
  ): Promise<OvertimeStats> {
    const overtimes =
      await this.overtimeRepoForSalary.findApprovedByUserAndDateRange(
        userId,
        startDate,
        endDate,
      );

    const stats = createOvertimeStats();
    const evaluationMap = createPayrollEvaluationMap(payrollEvaluations);
    const processedEvaluationDateKeys = new Set<string>();

    for (const overtime of overtimes) {
      const overtimeDate = overtime.startTime ?? overtime.createdAt;
      const dateKey = getDateKey(overtimeDate);
      const evaluation = dateKey ? evaluationMap.get(dateKey) : undefined;

      if (!evaluation) {
        applyOvertimeMinutes(
          stats,
          overtime.duration || 0,
          Boolean(overtime.isNationalHoliday),
          Boolean(overtime.isHolidayOvertime),
        );
        continue;
      }

      if (!dateKey || processedEvaluationDateKeys.has(dateKey)) {
        continue;
      }

      const isNationalHoliday = isNationalHolidayState(evaluation.holidayState);
      const isHolidayOvertime =
        evaluation.finalStatus === "DAY_OFF" ? !isNationalHoliday : false;

      applyOvertimeMinutes(
        stats,
        evaluation.overtimeMinutesApproved,
        isNationalHoliday,
        isHolidayOvertime,
      );

      processedEvaluationDateKeys.add(dateKey);
    }

    return stats;
  }

  private async getWorkOrderStats(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ completed: number }> {
    const count = await this.workOrderRepoForSalary.countCompletedForUser(
      userId,
      startDate,
      endDate,
    );

    return { completed: count };
  }
}
