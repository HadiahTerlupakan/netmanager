import { describe, it, expect } from "vitest";
import { TaxCalculator } from "@/modules/salary-v2/calculation/calculators/TaxCalculator";
import { createTestContext } from "@/modules/salary-v2/calculation/helpers/context-helpers";
import { buildLine } from "@/modules/salary-v2/calculation/helpers/line-builder";
import { ComponentCategory } from "@/modules/salary-v2/core";

describe("TaxCalculator", () => {
  const calculator = new TaxCalculator();

  it("should have correct metadata", () => {
    expect(calculator.name).toBe("Tax");
    expect(calculator.order).toBe(60);
    expect(calculator.applicableTo).toBeNull();
  });

  it("should calculate PPh 21 for NET method", () => {
    const previousLines = [
      buildLine({
        componentCode: "BASIC_SALARY",
        componentName: "Gaji Pokok",
        category: ComponentCategory.EARNING,
        amount: 10000000,
      }),
      buildLine({
        componentCode: "BPJS_JHT_EE",
        componentName: "BPJS JHT",
        category: ComponentCategory.DEDUCTION,
        amount: 200000,
      }),
    ];
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        taxMethod: "NET",
        ptkpStatus: "TK_0",
        basicSalary: 10000000,
      },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe("PPH21");
    expect(result.lines[0].category).toBe(ComponentCategory.TAX);
    expect(result.lines[0].amount).toBeGreaterThan(0);
  });

  it("should calculate PPh 21 for GROSS_UP method", () => {
    const previousLines = [
      buildLine({
        componentCode: "BASIC_SALARY",
        componentName: "Gaji Pokok",
        category: ComponentCategory.EARNING,
        amount: 10000000,
      }),
    ];
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        taxMethod: "GROSS_UP",
        ptkpStatus: "TK_0",
        basicSalary: 10000000,
      },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });
    const result = calculator.calculate(ctx);

    const taxAllowance = result.lines.find(
      (l) => l.componentCode === "TAX_ALLOWANCE",
    );
    const pph21 = result.lines.find((l) => l.componentCode === "PPH21");

    expect(taxAllowance).toBeDefined();
    expect(taxAllowance?.category).toBe(ComponentCategory.EARNING);
    expect(pph21).toBeDefined();
    expect(pph21?.category).toBe(ComponentCategory.TAX);
    expect(taxAllowance?.amount).toBe(pph21?.amount);
  });

  it("should calculate PPh 21 for NETT method", () => {
    const previousLines = [
      buildLine({
        componentCode: "BASIC_SALARY",
        componentName: "Gaji Pokok",
        category: ComponentCategory.EARNING,
        amount: 10000000,
      }),
    ];
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        taxMethod: "NETT",
        ptkpStatus: "TK_0",
        basicSalary: 10000000,
      },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });
    const result = calculator.calculate(ctx);

    const pph21 = result.lines.find((l) => l.componentCode === "PPH21");
    expect(pph21?.category).toBe(ComponentCategory.EMPLOYER_COST);
  });

  it("should apply 20% surcharge if no NPWP", () => {
    const previousLines = [
      buildLine({
        componentCode: "BASIC_SALARY",
        componentName: "Gaji Pokok",
        category: ComponentCategory.EARNING,
        amount: 10000000,
      }),
    ];
    const withNpwp = createTestContext({
      employee: {
        ...createTestContext().employee,
        taxMethod: "NET",
        npwp: "12.345.678.9-012.000",
        basicSalary: 10000000,
      },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });
    const withoutNpwp = createTestContext({
      employee: {
        ...createTestContext().employee,
        taxMethod: "NET",
        npwp: null,
        basicSalary: 10000000,
      },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });

    const resultWith = calculator.calculate(withNpwp);
    const resultWithout = calculator.calculate(withoutNpwp);

    const taxWith =
      resultWith.lines.find((l) => l.componentCode === "PPH21")?.amount ?? 0;
    const taxWithout =
      resultWithout.lines.find((l) => l.componentCode === "PPH21")?.amount ?? 0;

    expect(taxWithout).toBe(Math.floor(taxWith * 1.2));
  });

  it("should return zero tax if below PTKP", () => {
    const previousLines = [
      buildLine({
        componentCode: "BASIC_SALARY",
        componentName: "Gaji Pokok",
        category: ComponentCategory.EARNING,
        amount: 4500000,
      }),
    ];
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        taxMethod: "NET",
        ptkpStatus: "TK_0",
        basicSalary: 4500000,
      },
      previousLines,
      metadata: { effectiveSalary: 4500000 },
    });
    const result = calculator.calculate(ctx);

    const pph21 = result.lines.find((l) => l.componentCode === "PPH21");
    expect(pph21?.amount).toBe(0);
  });
});
