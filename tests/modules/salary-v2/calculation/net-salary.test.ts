import { describe, it, expect } from "vitest";
import { NetSalaryCalculator } from "@/modules/salary-v2/calculation/calculators/NetSalaryCalculator";
import { createTestContext } from "@/modules/salary-v2/calculation/helpers/context-helpers";
import { buildLine } from "@/modules/salary-v2/calculation/helpers/line-builder";
import { ComponentCategory } from "@/modules/salary-v2/core";

describe("NetSalaryCalculator", () => {
  const calculator = new NetSalaryCalculator();

  it("should have correct metadata", () => {
    expect(calculator.name).toBe("NetSalary");
    expect(calculator.order).toBe(99);
    expect(calculator.applicableTo).toBeNull();
  });

  it("should calculate net salary from previous lines", () => {
    const previousLines = [
      buildLine({
        componentCode: "BASIC_SALARY",
        componentName: "Gaji Pokok",
        category: ComponentCategory.EARNING,
        amount: 8000000,
      }),
      buildLine({
        componentCode: "ALW_TRANSPORT",
        componentName: "Transport",
        category: ComponentCategory.EARNING,
        amount: 500000,
      }),
      buildLine({
        componentCode: "BPJS_KES_EE",
        componentName: "BPJS Kes",
        category: ComponentCategory.DEDUCTION,
        amount: 80000,
      }),
      buildLine({
        componentCode: "BPJS_JHT_EE",
        componentName: "BPJS JHT",
        category: ComponentCategory.DEDUCTION,
        amount: 160000,
      }),
      buildLine({
        componentCode: "PPH21",
        componentName: "PPh 21",
        category: ComponentCategory.TAX,
        amount: 200000,
      }),
      buildLine({
        componentCode: "BPJS_KES_ER",
        componentName: "BPJS Kes ER",
        category: ComponentCategory.EMPLOYER_COST,
        amount: 320000,
      }),
    ];
    const ctx = createTestContext({ previousLines });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(0);
    expect(result.metadata?.totalEarnings).toBe(8500000);
    expect(result.metadata?.totalDeductions).toBe(240000);
    expect(result.metadata?.totalTax).toBe(200000);
    expect(result.metadata?.netSalary).toBe(8060000);
    expect(result.metadata?.totalEmployerCost).toBe(320000);
  });

  it("should handle zero earnings", () => {
    const ctx = createTestContext({ previousLines: [] });
    const result = calculator.calculate(ctx);

    expect(result.metadata?.totalEarnings).toBe(0);
    expect(result.metadata?.netSalary).toBe(0);
  });

  it("should handle negative net salary", () => {
    const previousLines = [
      buildLine({
        componentCode: "BASIC_SALARY",
        componentName: "Gaji",
        category: ComponentCategory.EARNING,
        amount: 1000000,
      }),
      buildLine({
        componentCode: "LOAN",
        componentName: "Pinjaman",
        category: ComponentCategory.DEDUCTION,
        amount: 1500000,
      }),
    ];
    const ctx = createTestContext({ previousLines });
    const result = calculator.calculate(ctx);

    expect(result.metadata?.netSalary).toBe(-500000);
    expect(result.metadata?.isNegative).toBe(true);
  });
});
