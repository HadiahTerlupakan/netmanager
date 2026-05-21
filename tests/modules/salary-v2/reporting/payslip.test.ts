import { describe, it, expect } from "vitest";
import { PayslipGenerator } from "@/modules/salary-v2/reporting/payslip/PayslipGenerator";
import type {
  PayslipEmployeeInfo,
  PayslipPeriodInfo,
} from "@/modules/salary-v2/reporting/payslip/PayslipGenerator";
import type { PayrollEntry } from "@/modules/salary-v2/core";
import {
  ComponentCategory,
  PayrollEntryStatus,
} from "@/modules/salary-v2/core";
import { buildLine } from "@/modules/salary-v2/calculation/helpers/line-builder";

function makeEntry(overrides: Partial<PayrollEntry> = {}): PayrollEntry {
  return {
    id: "entry-1",
    payrollRunId: "run-1",
    tenantId: "tenant-1",
    userId: "user-1",
    employeeType: "PKWTT",
    taxMethod: "NET",
    basicSalary: 5_000_000,
    effectiveSalary: 5_000_000,
    totalEarnings: 6_000_000,
    totalDeductions: 200_000,
    totalTax: 150_000,
    netSalary: 5_650_000,
    employerCost: 400_000,
    status: PayrollEntryStatus.CALCULATED,
    errorMessage: null,
    calculatedAt: new Date("2026-05-01"),
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
    ...overrides,
  };
}

const employee: PayslipEmployeeInfo = {
  name: "Budi Santoso",
  employeeId: "EMP-001",
  position: "Software Engineer",
  department: "Engineering",
  bankAccount: "1234567890",
};

const period: PayslipPeriodInfo = {
  periodStart: new Date("2026-05-01"),
  periodEnd: new Date("2026-05-31"),
  payDate: new Date("2026-06-01"),
};

describe("PayslipGenerator", () => {
  const generator = new PayslipGenerator();

  it("should group lines by category", () => {
    const lines = [
      buildLine({
        componentCode: "BASIC",
        componentName: "Gaji Pokok",
        category: ComponentCategory.EARNING,
        amount: 5_000_000,
        sortOrder: 1,
      }),
      buildLine({
        componentCode: "TRANSPORT",
        componentName: "Tunjangan Transport",
        category: ComponentCategory.EARNING,
        amount: 1_000_000,
        sortOrder: 2,
      }),
      buildLine({
        componentCode: "BPJS_KES_EE",
        componentName: "BPJS Kesehatan",
        category: ComponentCategory.DEDUCTION,
        amount: 200_000,
        sortOrder: 1,
      }),
      buildLine({
        componentCode: "PPH21",
        componentName: "PPh 21",
        category: ComponentCategory.TAX,
        amount: 150_000,
        sortOrder: 1,
      }),
      buildLine({
        componentCode: "BPJS_KES_ER",
        componentName: "BPJS Kesehatan (Perusahaan)",
        category: ComponentCategory.EMPLOYER_COST,
        amount: 400_000,
        sortOrder: 1,
      }),
    ];

    const result = generator.generate({
      entry: makeEntry(),
      lines,
      employee,
      period,
    });

    expect(result.earnings).toHaveLength(2);
    expect(result.deductions).toHaveLength(1);
    expect(result.taxes).toHaveLength(1);
    expect(result.employerCosts).toHaveLength(1);
  });

  it("should sort lines by sortOrder within each category", () => {
    const lines = [
      buildLine({
        componentCode: "TRANSPORT",
        componentName: "Tunjangan Transport",
        category: ComponentCategory.EARNING,
        amount: 1_000_000,
        sortOrder: 3,
      }),
      buildLine({
        componentCode: "BASIC",
        componentName: "Gaji Pokok",
        category: ComponentCategory.EARNING,
        amount: 5_000_000,
        sortOrder: 1,
      }),
      buildLine({
        componentCode: "MEAL",
        componentName: "Tunjangan Makan",
        category: ComponentCategory.EARNING,
        amount: 500_000,
        sortOrder: 2,
      }),
    ];

    const result = generator.generate({
      entry: makeEntry(),
      lines,
      employee,
      period,
    });

    expect(result.earnings[0].code).toBe("BASIC");
    expect(result.earnings[1].code).toBe("MEAL");
    expect(result.earnings[2].code).toBe("TRANSPORT");
  });

  it("should map line fields to PayslipLineItem correctly", () => {
    const lines = [
      buildLine({
        componentCode: "OT",
        componentName: "Lembur",
        category: ComponentCategory.EARNING,
        amount: 300_000,
        quantity: 10,
        rate: 30_000,
        sortOrder: 1,
      }),
    ];

    const result = generator.generate({
      entry: makeEntry(),
      lines,
      employee,
      period,
    });

    expect(result.earnings[0]).toEqual({
      name: "Lembur",
      code: "OT",
      quantity: 10,
      rate: 30_000,
      amount: 300_000,
    });
  });

  it("should use entry totals for summary", () => {
    const entry = makeEntry({
      totalEarnings: 7_500_000,
      totalDeductions: 500_000,
      totalTax: 250_000,
      netSalary: 6_750_000,
      employerCost: 600_000,
    });

    const result = generator.generate({ entry, lines: [], employee, period });

    expect(result.summary).toEqual({
      totalEarnings: 7_500_000,
      totalDeductions: 500_000,
      totalTax: 250_000,
      netSalary: 6_750_000,
      totalEmployerCost: 600_000,
    });
  });

  it("should include employee and period info", () => {
    const result = generator.generate({
      entry: makeEntry(),
      lines: [],
      employee,
      period,
    });

    expect(result.employee).toEqual(employee);
    expect(result.period).toEqual(period);
  });

  it("should set generatedAt timestamp", () => {
    const before = new Date();
    const result = generator.generate({
      entry: makeEntry(),
      lines: [],
      employee,
      period,
    });
    const after = new Date();

    expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(result.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should handle empty lines gracefully", () => {
    const result = generator.generate({
      entry: makeEntry(),
      lines: [],
      employee,
      period,
    });

    expect(result.earnings).toEqual([]);
    expect(result.deductions).toEqual([]);
    expect(result.taxes).toEqual([]);
    expect(result.employerCosts).toEqual([]);
  });
});
