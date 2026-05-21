import {
  getPayrollRunRepository,
  getPayrollEntryRepository,
  getEmployeeProfileRepository,
  getCalculationEngine,
  PayrollRunStatus,
  DEFAULT_BPJS_CONFIG,
  DEFAULT_TAX_CONFIG,
  DEFAULT_OVERTIME_CONFIG,
  sumEarnings,
  sumDeductions,
  sumTax,
  sumEmployerCost,
} from "@/modules/salary-v2";
import type {
  CalculationContext,
  TenantPayrollConfig,
} from "@/modules/salary-v2";

type CalculateRunResult = {
  runId: string;
  calculated: number;
  errors: number;
  totalNetSalary: number;
  totalEmployerCost: number;
};

export type CalculateRunError =
  | { code: "NOT_FOUND" }
  | { code: "INVALID_STATUS"; message: string }
  | { code: "NO_EMPLOYEES"; message: string };

const runRepo = getPayrollRunRepository();
const entryRepo = getPayrollEntryRepository();
const profileRepo = getEmployeeProfileRepository();

function buildTenantConfig(tenantId: string): TenantPayrollConfig {
  return {
    tenantId,
    bpjs: DEFAULT_BPJS_CONFIG,
    tax: DEFAULT_TAX_CONFIG,
    overtime: DEFAULT_OVERTIME_CONFIG,
    thrConfig: {
      eligibleAfterMonths: 1,
      fullEntitlementMonths: 12,
      prorata: true,
      components: ["BASIC_SALARY"],
      paymentDeadlineDays: 7,
    },
    advancePolicy: {
      maxPercentOfSalary: 30,
      maxActiveAdvances: 1,
      minDaysBetweenRequests: 30,
      approvalRequired: true,
      deductionMethod: "INSTALLMENT",
      maxInstallments: 3,
    },
    periodLocking: {
      autoLockAfterPaid: true,
      autoLockDelayDays: 7,
      requireApprovalToUnlock: true,
      maxUnlockCount: 2,
    },
  };
}

function buildCalculationContext(
  profile: Awaited<ReturnType<typeof profileRepo.findAll>>[number],
  run: { periodStart: Date; periodEnd: Date },
  tenantConfig: TenantPayrollConfig,
): CalculationContext {
  return {
    employee: profile,
    period: { start: run.periodStart, end: run.periodEnd },
    attendance: {
      totalWorkDays: 22,
      presentDays: 22,
      absentDays: 0,
      lateDays: 0,
      sickDays: 0,
      permitDays: 0,
      effectiveDays: 22,
    },
    overtime: {
      normalMinutes: 0,
      holidayMinutes: 0,
      nationalHolidayMinutes: 0,
      totalMinutes: 0,
    },
    previousLines: [],
    config: tenantConfig,
    metadata: {},
  };
}

export async function calculatePayrollRun(
  runId: string,
  tenantId: string,
): Promise<
  | { success: true; data: CalculateRunResult }
  | { success: false; error: CalculateRunError }
> {
  const run = await runRepo.findById(runId, tenantId);
  if (!run) {
    return { success: false, error: { code: "NOT_FOUND" } };
  }

  if (run.status !== "DRAFT" && run.status !== "REVISION_REQUESTED") {
    return {
      success: false,
      error: {
        code: "INVALID_STATUS",
        message:
          "Kalkulasi hanya dapat dilakukan pada run berstatus DRAFT atau REVISION_REQUESTED",
      },
    };
  }

  await runRepo.updateStatus(runId, tenantId, PayrollRunStatus.CALCULATING);

  try {
    const profiles = await profileRepo.findAll({
      tenantId,
      payScheduleId: run.scheduleId,
      isActive: true,
    });

    if (profiles.length === 0) {
      await runRepo.updateStatus(runId, tenantId, PayrollRunStatus.DRAFT);
      return {
        success: false,
        error: {
          code: "NO_EMPLOYEES",
          message: "Tidak ada karyawan aktif untuk jadwal ini",
        },
      };
    }

    await entryRepo.deleteByRunId(runId, tenantId);

    const engine = getCalculationEngine();
    const tenantConfig = buildTenantConfig(tenantId);
    let successCount = 0;
    let errorCount = 0;
    let totalNet = 0;
    let totalEmployerCost = 0;

    for (const profile of profiles) {
      try {
        const entry = await entryRepo.create({
          payrollRunId: runId,
          tenantId,
          userId: profile.userId,
          employeeType: profile.employeeType,
          taxMethod: profile.taxMethod,
          basicSalary: profile.basicSalary,
          effectiveSalary: 0,
          totalEarnings: 0,
          totalDeductions: 0,
          totalTax: 0,
          netSalary: 0,
          employerCost: 0,
          status: "PENDING",
          errorMessage: null,
          calculatedAt: null,
        });

        const calcContext = buildCalculationContext(profile, run, tenantConfig);
        const result = engine.calculate(calcContext);
        const lines = result.lines;

        await entryRepo.setLines(entry.id, tenantId, lines);

        const earnings = sumEarnings(lines);
        const deductions = sumDeductions(lines);
        const tax = sumTax(lines);
        const employerCost = sumEmployerCost(lines);
        const netSalary = earnings - deductions - tax;

        await entryRepo.update(entry.id, tenantId, {
          effectiveSalary: profile.basicSalary,
          totalEarnings: earnings,
          totalDeductions: deductions,
          totalTax: tax,
          netSalary,
          employerCost,
          status: "CALCULATED",
          calculatedAt: new Date(),
        });

        totalNet += netSalary;
        totalEmployerCost += employerCost;
        successCount++;
      } catch (err) {
        errorCount++;
        const existingEntry = await entryRepo.findByUserAndRun(
          profile.userId,
          runId,
          tenantId,
        );
        if (existingEntry) {
          await entryRepo.updateStatus(
            existingEntry.id,
            tenantId,
            "ERROR",
            err instanceof Error ? err.message : "Unknown error",
          );
        }
      }
    }

    await runRepo.update(runId, tenantId, {
      totalEntries: successCount,
      totalNetSalary: totalNet,
      totalEmployerCost,
      status: PayrollRunStatus.CALCULATED,
    });

    return {
      success: true,
      data: {
        runId,
        calculated: successCount,
        errors: errorCount,
        totalNetSalary: totalNet,
        totalEmployerCost,
      },
    };
  } catch (err) {
    await runRepo.updateStatus(runId, tenantId, PayrollRunStatus.DRAFT);
    throw err;
  }
}
