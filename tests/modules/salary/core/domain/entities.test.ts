import { describe, it, expect } from "vitest";
import type { PayrollComponent } from "@/modules/salary/core/domain/entities/PayrollComponent";
import type {
  EmployeePayrollProfile,
  BpjsEnrollment,
  EmployeeComponent,
} from "@/modules/salary/core/domain/entities/EmployeePayrollProfile";
import type { PayrollRun } from "@/modules/salary/core/domain/entities/PayrollRun";
import type { PayrollEntry } from "@/modules/salary/core/domain/entities/PayrollEntry";
import type { PayrollLine } from "@/modules/salary/core/domain/entities/PayrollLine";
import type { PaySchedule } from "@/modules/salary/core/domain/entities/PaySchedule";
import type { PayrollPeriod } from "@/modules/salary/core/domain/entities/PayrollPeriod";
import type { PayrollAuditLog } from "@/modules/salary/core/domain/entities/PayrollAuditLog";
import type { SalaryAdvance } from "@/modules/salary/core/domain/entities/SalaryAdvance";
import type { RegionalMinimumWage } from "@/modules/salary/core/domain/entities/RegionalMinimumWage";
import {
  ComponentCategory,
  ComponentCalculationType,
  EmployeeType,
  TaxMethod,
  PayrollRunStatus,
  PayrollRunType,
  PayrollEntryStatus,
  PayFrequency,
  PayrollPeriodStatus,
  AuditAction,
  SalaryAdvanceStatus,
} from "@/modules/salary/core/domain/enums";

describe("Domain Entities", () => {
  describe("PayrollComponent", () => {
    it("should define a valid payroll component structure", () => {
      const component: PayrollComponent = {
        id: "comp-1",
        tenantId: "tenant-1",
        name: "Tunjangan Transport",
        code: "ALW_TRANSPORT",
        category: ComponentCategory.EARNING,
        calculationType: ComponentCalculationType.FIXED,
        taxable: true,
        applicableTo: [EmployeeType.PKWTT, EmployeeType.PKWT],
        isStatutory: false,
        formula: null,
        defaultAmount: 500000,
        sortOrder: 10,
        isActive: true,
        description: "Tunjangan transportasi bulanan",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(component.name).toBe("Tunjangan Transport");
      expect(component.category).toBe("EARNING");
    });
  });

  describe("EmployeePayrollProfile", () => {
    it("should define a valid employee payroll profile", () => {
      const bpjs: BpjsEnrollment = {
        kesehatan: true,
        jht: true,
        jp: true,
        jkk: true,
        jkm: true,
      };
      const component: EmployeeComponent = {
        componentId: "comp-1",
        componentCode: "ALW_TRANSPORT",
        componentName: "Tunjangan Transport",
        category: ComponentCategory.EARNING,
        calculationType: ComponentCalculationType.FIXED,
        amount: 600000,
        isActive: true,
      };
      const profile: EmployeePayrollProfile = {
        id: "profile-1",
        userId: "user-1",
        tenantId: "tenant-1",
        employeeType: EmployeeType.PKWTT,
        taxMethod: TaxMethod.NET,
        payScheduleId: "schedule-monthly",
        basicSalary: 8000000,
        payPeriodDay: 25,
        ptkpStatus: "K_1",
        npwp: "12.345.678.9-012.000",
        bpjsConfig: bpjs,
        regionCode: "ID-JK",
        contractStart: new Date("2024-01-15"),
        contractEnd: null,
        overtimeEligible: true,
        thrEligible: true,
        isActive: true,
        components: [component],
      };
      expect(profile.employeeType).toBe("PKWTT");
      expect(profile.components).toHaveLength(1);
    });
  });

  describe("PayrollRun", () => {
    it("should define a valid payroll run", () => {
      const run: PayrollRun = {
        id: "run-1",
        tenantId: "tenant-1",
        scheduleId: "schedule-monthly",
        type: PayrollRunType.REGULAR,
        status: PayrollRunStatus.DRAFT,
        periodStart: new Date("2026-04-26"),
        periodEnd: new Date("2026-05-25"),
        payDate: new Date("2026-05-28"),
        totalEntries: 0,
        totalNetSalary: 0,
        totalEmployerCost: 0,
        lockedAt: null,
        lockedBy: null,
        notes: null,
        createdBy: "user-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(run.type).toBe("REGULAR");
      expect(run.status).toBe("DRAFT");
    });
  });

  describe("PayrollEntry", () => {
    it("should define a valid payroll entry", () => {
      const entry: PayrollEntry = {
        id: "entry-1",
        payrollRunId: "run-1",
        tenantId: "tenant-1",
        userId: "user-1",
        employeeType: EmployeeType.PKWTT,
        taxMethod: TaxMethod.NET,
        basicSalary: 8000000,
        effectiveSalary: 8000000,
        totalEarnings: 9500000,
        totalDeductions: 480000,
        totalTax: 285000,
        netSalary: 8735000,
        employerCost: 720000,
        status: PayrollEntryStatus.CALCULATED,
        errorMessage: null,
        calculatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(entry.status).toBe("CALCULATED");
      expect(entry.netSalary).toBe(8735000);
    });
  });

  describe("PayrollLine", () => {
    it("should define a valid payroll line", () => {
      const line: PayrollLine = {
        id: "line-1",
        entryId: "entry-1",
        tenantId: "tenant-1",
        componentId: "comp-1",
        componentCode: "BASIC_SALARY",
        componentName: "Gaji Pokok",
        category: ComponentCategory.EARNING,
        quantity: 1,
        rate: 8000000,
        amount: 8000000,
        formula: "basicSalary",
        metadata: null,
        sortOrder: 1,
      };
      expect(line.category).toBe("EARNING");
      expect(line.amount).toBe(8000000);
    });
  });

  describe("PaySchedule", () => {
    it("should define a valid pay schedule", () => {
      const schedule: PaySchedule = {
        id: "schedule-1",
        tenantId: "tenant-1",
        name: "Bulanan Standar",
        frequency: PayFrequency.MONTHLY,
        cutOffDay: 25,
        cutOffDayOfWeek: null,
        payDay: 28,
        payDayOffset: null,
        gracePeriodDays: 3,
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(schedule.frequency).toBe("MONTHLY");
      expect(schedule.isDefault).toBe(true);
    });
  });

  describe("PayrollPeriod", () => {
    it("should define a valid payroll period", () => {
      const period: PayrollPeriod = {
        id: "period-1",
        tenantId: "tenant-1",
        scheduleId: "schedule-1",
        periodStart: new Date("2026-04-26"),
        periodEnd: new Date("2026-05-25"),
        payDate: new Date("2026-05-28"),
        status: PayrollPeriodStatus.OPEN,
        lockedAt: null,
        lockedBy: null,
        unlockReason: null,
        unlockCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(period.status).toBe("OPEN");
    });
  });

  describe("PayrollAuditLog", () => {
    it("should define a valid audit log entry", () => {
      const log: PayrollAuditLog = {
        id: "log-1",
        tenantId: "tenant-1",
        entityType: "PAYROLL_RUN",
        entityId: "run-1",
        action: AuditAction.STATUS_CHANGED,
        performedBy: "user-admin",
        timestamp: new Date(),
        changes: [
          { field: "status", oldValue: "DRAFT", newValue: "CALCULATING" },
        ],
        reason: null,
        ipAddress: "192.168.1.1",
      };
      expect(log.action).toBe("STATUS_CHANGED");
      expect(log.changes).toHaveLength(1);
    });
  });

  describe("SalaryAdvance", () => {
    it("should define a valid salary advance", () => {
      const advance: SalaryAdvance = {
        id: "advance-1",
        tenantId: "tenant-1",
        userId: "user-1",
        amount: 2000000,
        requestDate: new Date(),
        approvedBy: null,
        approvedAt: null,
        status: SalaryAdvanceStatus.PENDING,
        deductionMethod: "FULL_NEXT",
        installmentCount: null,
        remainingAmount: 2000000,
        reason: "Keperluan mendesak",
        rejectionReason: null,
        disbursedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(advance.status).toBe("PENDING");
      expect(advance.amount).toBe(2000000);
    });
  });

  describe("RegionalMinimumWage", () => {
    it("should define a valid UMR entry", () => {
      const umr: RegionalMinimumWage = {
        id: "umr-1",
        tenantId: "tenant-1",
        regionCode: "ID-JK",
        regionName: "DKI Jakarta",
        year: 2026,
        monthlyAmount: 5067381,
        dailyAmount: 241304,
        effectiveDate: new Date("2026-01-01"),
        source: "Pergub DKI Jakarta No. 120/2025",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(umr.regionCode).toBe("ID-JK");
      expect(umr.monthlyAmount).toBe(5067381);
    });
  });
});
