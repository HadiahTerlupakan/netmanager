import { describe, it, expect } from "vitest";
import {
  ComplianceRuleEngine,
  UMR_CHECK,
  NEGATIVE_NET_SALARY,
  OVERTIME_DAILY_CAP,
  BPJS_ENROLLMENT,
} from "@/modules/salary-v2/workflow/compliance/ComplianceRuleEngine";
import type { ComplianceCheckContext } from "@/modules/salary-v2/workflow/compliance/ComplianceRuleEngine";
import type { PayrollEntry } from "@/modules/salary-v2/core";

function createTestEntry(overrides: Partial<PayrollEntry> = {}): PayrollEntry {
  return {
    id: "entry-1",
    payrollRunId: "run-1",
    tenantId: "tenant-1",
    userId: "user-1",
    employeeType: "PKWTT",
    taxMethod: "GROSS_UP",
    basicSalary: 8000000,
    effectiveSalary: 8000000,
    totalEarnings: 9000000,
    totalDeductions: 1000000,
    totalTax: 500000,
    netSalary: 7500000,
    employerCost: 9500000,
    status: "CALCULATED",
    errorMessage: null,
    calculatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createTestContext(
  overrides: Partial<ComplianceCheckContext> = {},
): ComplianceCheckContext {
  return {
    entry: createTestEntry(),
    profile: {
      userId: "user-1",
      regionCode: "JKT",
      bpjsConfig: {
        kesehatan: true,
        jht: true,
        jp: true,
        jkk: true,
        jkm: true,
      },
      overtimeEligible: true,
    },
    overtimeHoursDaily: 2,
    regionalWage: {
      id: "umr-1",
      tenantId: "tenant-1",
      regionCode: "JKT",
      regionName: "DKI Jakarta",
      year: 2026,
      monthlyAmount: 5000000,
      dailyAmount: null,
      effectiveDate: new Date("2026-01-01"),
      source: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  };
}

describe("ComplianceRuleEngine", () => {
  describe("UMR_CHECK", () => {
    it("should pass when salary meets minimum wage", () => {
      const ctx = createTestContext();
      const result = UMR_CHECK.check(ctx);

      expect(result.passed).toBe(true);
      expect(result.ruleName).toBe("UMR_CHECK");
      expect(result.severity).toBe("ERROR");
    });

    it("should fail when salary is below minimum wage", () => {
      const ctx = createTestContext({
        entry: createTestEntry({ effectiveSalary: 4000000 }),
      });
      const result = UMR_CHECK.check(ctx);

      expect(result.passed).toBe(false);
      expect(result.message).toContain("below UMR");
      expect(result.suggestion).toContain("5000000");
    });

    it("should fail when no regional wage data exists", () => {
      const ctx = createTestContext({ regionalWage: null });
      const result = UMR_CHECK.check(ctx);

      expect(result.passed).toBe(false);
      expect(result.message).toContain("No regional minimum wage data");
      expect(result.suggestion).toContain("Configure");
    });
  });

  describe("NEGATIVE_NET_SALARY", () => {
    it("should pass when net salary is positive", () => {
      const ctx = createTestContext();
      const result = NEGATIVE_NET_SALARY.check(ctx);

      expect(result.passed).toBe(true);
    });

    it("should pass when net salary is zero", () => {
      const ctx = createTestContext({
        entry: createTestEntry({ netSalary: 0 }),
      });
      const result = NEGATIVE_NET_SALARY.check(ctx);

      expect(result.passed).toBe(true);
    });

    it("should fail when net salary is negative", () => {
      const ctx = createTestContext({
        entry: createTestEntry({ netSalary: -500000 }),
      });
      const result = NEGATIVE_NET_SALARY.check(ctx);

      expect(result.passed).toBe(false);
      expect(result.message).toContain("negative");
      expect(result.suggestion).toContain("deductions");
    });
  });

  describe("OVERTIME_DAILY_CAP", () => {
    it("should pass when overtime is within cap", () => {
      const ctx = createTestContext({ overtimeHoursDaily: 2 });
      const result = OVERTIME_DAILY_CAP.check(ctx);

      expect(result.passed).toBe(true);
    });

    it("should pass when overtime equals cap (3h)", () => {
      const ctx = createTestContext({ overtimeHoursDaily: 3 });
      const result = OVERTIME_DAILY_CAP.check(ctx);

      expect(result.passed).toBe(true);
    });

    it("should warn when overtime exceeds cap", () => {
      const ctx = createTestContext({ overtimeHoursDaily: 5 });
      const result = OVERTIME_DAILY_CAP.check(ctx);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe("WARNING");
      expect(result.message).toContain("exceeds cap");
    });

    it("should skip check for non-overtime-eligible employees", () => {
      const ctx = createTestContext({
        overtimeHoursDaily: 10,
        profile: {
          userId: "user-1",
          regionCode: "JKT",
          bpjsConfig: {
            kesehatan: true,
            jht: true,
            jp: true,
            jkk: true,
            jkm: true,
          },
          overtimeEligible: false,
        },
      });
      const result = OVERTIME_DAILY_CAP.check(ctx);

      expect(result.passed).toBe(true);
      expect(result.message).toContain("not eligible");
    });
  });

  describe("BPJS_ENROLLMENT", () => {
    it("should pass when all mandatory programs enrolled", () => {
      const ctx = createTestContext();
      const result = BPJS_ENROLLMENT.check(ctx);

      expect(result.passed).toBe(true);
    });

    it("should warn when missing BPJS programs", () => {
      const ctx = createTestContext({
        profile: {
          userId: "user-1",
          regionCode: "JKT",
          bpjsConfig: {
            kesehatan: false,
            jht: true,
            jp: true,
            jkk: false,
            jkm: true,
          },
          overtimeEligible: true,
        },
      });
      const result = BPJS_ENROLLMENT.check(ctx);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe("WARNING");
      expect(result.message).toContain("Kesehatan");
      expect(result.message).toContain("JKK");
    });
  });

  describe("Engine - checkEntry", () => {
    it("should run all default rules", () => {
      const engine = new ComplianceRuleEngine();
      const ctx = createTestContext();
      const result = engine.checkEntry(ctx);

      expect(result.totalChecks).toBe(4);
      expect(result.passed).toBe(4);
      expect(result.failed).toBe(0);
      expect(result.hasBlockingErrors).toBe(false);
    });

    it("should separate errors and warnings", () => {
      const engine = new ComplianceRuleEngine();
      const ctx = createTestContext({
        entry: createTestEntry({ netSalary: -100, effectiveSalary: 3000000 }),
        overtimeHoursDaily: 5,
      });
      const result = engine.checkEntry(ctx);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.hasBlockingErrors).toBe(true);
    });

    it("should support custom rules", () => {
      const engine = new ComplianceRuleEngine([]);
      engine.addRule({
        name: "CUSTOM_CHECK",
        severity: "WARNING",
        check: (ctx) => ({
          ruleName: "CUSTOM_CHECK",
          severity: "WARNING",
          passed: ctx.entry.basicSalary > 0,
          message: "Custom check",
          suggestion: null,
          affectedEntryId: ctx.entry.id,
        }),
      });

      const ctx = createTestContext();
      const result = engine.checkEntry(ctx);

      expect(result.totalChecks).toBe(1);
      expect(result.passed).toBe(1);
    });
  });

  describe("Engine - checkAll", () => {
    it("should aggregate results across multiple entries", () => {
      const engine = new ComplianceRuleEngine();
      const contexts = [
        createTestContext(),
        createTestContext({
          entry: createTestEntry({ id: "entry-2", netSalary: -100 }),
        }),
      ];
      const result = engine.checkAll(contexts);

      expect(result.totalChecks).toBe(8); // 4 rules x 2 entries
      expect(result.hasBlockingErrors).toBe(true);
      expect(result.errors.some((e) => e.affectedEntryId === "entry-2")).toBe(
        true,
      );
    });
  });

  describe("Engine - getRules", () => {
    it("should return registered rules", () => {
      const engine = new ComplianceRuleEngine();
      expect(engine.getRules()).toHaveLength(4);
    });
  });
});
