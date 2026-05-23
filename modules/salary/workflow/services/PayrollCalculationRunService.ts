import {
  getPayrollRunRepository,
  getPayrollEntryRepository,
  getEmployeeProfileRepository,
  getCalculationEngine,
  getAttendanceBridge,
  getOvertimeBridge,
  getLoanBridge,
  PayrollRunStatus,
  sumEarnings,
  sumDeductions,
  sumTax,
  sumEmployerCost,
} from "@/modules/salary";
import type { CalculationContext, TenantPayrollConfig } from "@/modules/salary";
import { getPayrollConfig } from "@/modules/salary/config/PayrollConfigStore";
import { PrismaTaxHistoryLoader } from "@/modules/salary/tax/providers/PrismaTaxHistoryLoader";

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

function getRepos() {
  return {
    runRepo: getPayrollRunRepository(),
    entryRepo: getPayrollEntryRepository(),
    profileRepo: getEmployeeProfileRepository(),
    attendanceBridge: getAttendanceBridge(),
    overtimeBridge: getOvertimeBridge(),
    loanBridge: getLoanBridge(),
  };
}

async function buildCalculationContext(
  profile: CalculationContext["employee"],
  run: { periodStart: Date; periodEnd: Date },
  tenantConfig: TenantPayrollConfig,
): Promise<CalculationContext> {
  const { attendanceBridge, overtimeBridge, loanBridge } = getRepos();
  const [attendance, overtime, activeLoans, activeAdvances] = await Promise.all(
    [
      attendanceBridge.getAttendanceSummary(
        profile.userId,
        run.periodStart,
        run.periodEnd,
        tenantConfig.tenantId,
      ),
      overtimeBridge.getOvertimeSummary(
        profile.userId,
        run.periodStart,
        run.periodEnd,
        tenantConfig.tenantId,
      ),
      loanBridge.getActiveLoans(profile.userId, tenantConfig.tenantId),
      loanBridge.getActiveAdvances(profile.userId, tenantConfig.tenantId),
    ],
  );

  return {
    employee: profile,
    period: { start: run.periodStart, end: run.periodEnd },
    attendance,
    overtime,
    previousLines: [],
    config: tenantConfig,
    metadata: {
      activeLoans,
      activeAdvances,
    },
  };
}

export async function calculatePayrollRun(
  runId: string,
  tenantId: string,
): Promise<
  | { success: true; data: CalculateRunResult }
  | { success: false; error: CalculateRunError }
> {
  const { runRepo, entryRepo, profileRepo } = getRepos();
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

    const tenantConfig = getPayrollConfig(tenantId);

    // Pre-load YTD tax history dari payroll entries final (APPROVED/PAID/CLOSED)
    // tahun yang sama. Ini penting untuk:
    //   1. Koreksi PPh21 Desember (annual reconciliation)
    //   2. Karyawan resign mid-year (perhitungan totalGross & totalTaxPaid)
    //   3. Karyawan masuk mid-year (monthsWorked accurate)
    const periodYear = run.periodStart.getFullYear();
    const userIds = profiles.map((p) => p.userId);
    const taxHistoryLoader = new PrismaTaxHistoryLoader();
    const taxHistoryProvider = await taxHistoryLoader.buildProvider(
      tenantId,
      userIds,
      periodYear,
    );

    const engine = getCalculationEngine(taxHistoryProvider);
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

        const calcContext = await buildCalculationContext(
          profile,
          run,
          tenantConfig,
        );
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
