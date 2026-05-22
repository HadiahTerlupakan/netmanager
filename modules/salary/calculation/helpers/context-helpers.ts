import type {
  CalculationContext,
  EmployeePayrollProfile,
  AttendanceSummary,
  OvertimeSummary,
  TenantPayrollConfig,
} from "@/modules/salary/core";
import {
  DEFAULT_BPJS_CONFIG,
  DEFAULT_TAX_CONFIG,
  DEFAULT_OVERTIME_CONFIG,
} from "@/modules/salary/core";

/**
 * Create a fully-populated CalculationContext for testing.
 * Override any field via the `overrides` parameter.
 */
export function createTestContext(
  overrides?: Partial<CalculationContext>,
): CalculationContext {
  const defaultEmployee: EmployeePayrollProfile = {
    id: "profile-test-1",
    userId: "user-1",
    tenantId: "tenant-1",
    employeeType: "PKWTT",
    taxMethod: "NET",
    payScheduleId: "schedule-1",
    basicSalary: 8000000,
    payPeriodDay: 25,
    ptkpStatus: "TK_0",
    npwp: "12.345.678.9-012.000",
    bpjsConfig: { kesehatan: true, jht: true, jp: true, jkk: true, jkm: true },
    regionCode: "ID-JK",
    contractStart: new Date("2024-01-15"),
    contractEnd: null,
    overtimeEligible: true,
    thrEligible: true,
    isActive: true,
    components: [],
  };

  const defaultAttendance: AttendanceSummary = {
    totalWorkDays: 22,
    presentDays: 22,
    absentDays: 0,
    lateDays: 0,
    sickDays: 0,
    permitDays: 0,
    effectiveDays: 22,
  };

  const defaultOvertime: OvertimeSummary = {
    normalMinutes: 0,
    holidayMinutes: 0,
    nationalHolidayMinutes: 0,
    totalMinutes: 0,
  };

  const defaultConfig: TenantPayrollConfig = {
    tenantId: "tenant-1",
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
      maxPercentOfSalary: 0.3,
      maxActiveAdvances: 2,
      minDaysBetweenRequests: 30,
      approvalRequired: true,
      deductionMethod: "FULL_NEXT",
      maxInstallments: 6,
    },
    periodLocking: {
      autoLockAfterPaid: true,
      autoLockDelayDays: 3,
      requireApprovalToUnlock: true,
      maxUnlockCount: 2,
    },
  };

  return {
    employee: overrides?.employee ?? defaultEmployee,
    period: overrides?.period ?? {
      start: new Date("2026-04-26"),
      end: new Date("2026-05-25"),
    },
    attendance: overrides?.attendance ?? defaultAttendance,
    overtime: overrides?.overtime ?? defaultOvertime,
    previousLines: overrides?.previousLines ?? [],
    config: overrides?.config ?? defaultConfig,
    metadata: overrides?.metadata ?? {},
  };
}
