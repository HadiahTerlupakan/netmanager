import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
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

const runRepo = getPayrollRunRepository();
const entryRepo = getPayrollEntryRepository();
const profileRepo = getEmployeeProfileRepository();

/** POST /api/admin/salary-v2/runs/[id]/calculate — Trigger calculation for a payroll run */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghitung payroll",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  // Validate run exists and is in correct state
  const run = await runRepo.findById(id, tenantId);
  if (!run) {
    return ApiErrors.notFound("Payroll run");
  }

  if (run.status !== "DRAFT" && run.status !== "REVISION_REQUESTED") {
    return ApiErrors.badRequest(
      "Kalkulasi hanya dapat dilakukan pada run berstatus DRAFT atau REVISION_REQUESTED",
    );
  }

  // Update status to CALCULATING
  await runRepo.updateStatus(id, tenantId, PayrollRunStatus.CALCULATING);

  try {
    // Get all employee profiles for this schedule
    const profiles = await profileRepo.findAll({
      tenantId,
      payScheduleId: run.scheduleId,
      isActive: true,
    });

    if (profiles.length === 0) {
      await runRepo.updateStatus(id, tenantId, PayrollRunStatus.DRAFT);
      return ApiErrors.badRequest("Tidak ada karyawan aktif untuk jadwal ini");
    }

    // Clear existing entries for recalculation
    await entryRepo.deleteByRunId(id, tenantId);

    const engine = getCalculationEngine();
    let successCount = 0;
    let errorCount = 0;
    let totalNet = 0;
    let totalEmployerCost = 0;

    // Default tenant config (TODO: load from tenant settings)
    const tenantConfig: TenantPayrollConfig = {
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

    for (const profile of profiles) {
      try {
        // Create entry
        const entry = await entryRepo.create({
          payrollRunId: id,
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

        // Build calculation context matching CalculationContext interface
        const calcContext: CalculationContext = {
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

        // Run calculation
        const result = engine.calculate(calcContext);
        const lines = result.lines;

        // Save lines
        await entryRepo.setLines(entry.id, tenantId, lines);

        // Compute totals from lines
        const earnings = sumEarnings(lines);
        const deductions = sumDeductions(lines);
        const tax = sumTax(lines);
        const employerCost = sumEmployerCost(lines);
        const netSalary = earnings - deductions - tax;

        // Update entry with totals
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
        // Mark entry as error if it was created
        const existingEntry = await entryRepo.findByUserAndRun(
          profile.userId,
          id,
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

    // Update run totals and status
    await runRepo.update(id, tenantId, {
      totalEntries: successCount,
      totalNetSalary: totalNet,
      totalEmployerCost: totalEmployerCost,
      status: PayrollRunStatus.CALCULATED,
    });

    return apiSuccess(
      {
        runId: id,
        calculated: successCount,
        errors: errorCount,
        totalNetSalary: totalNet,
        totalEmployerCost: totalEmployerCost,
      },
      {
        message: `Kalkulasi selesai: ${successCount} berhasil, ${errorCount} gagal`,
      },
    );
  } catch (err) {
    // Revert status on unexpected failure
    await runRepo.updateStatus(id, tenantId, PayrollRunStatus.DRAFT);
    throw err;
  }
});
