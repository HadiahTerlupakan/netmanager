import { describe, it, expect } from "vitest";
import { ProrataCalculator } from "@/modules/salary-v2/calculation/calculators/ProrataCalculator";
import { createTestContext } from "@/modules/salary-v2/calculation/helpers/context-helpers";
import { buildLine } from "@/modules/salary-v2/calculation/helpers/line-builder";
import { ComponentCategory } from "@/modules/salary-v2/core";

describe("ProrataCalculator", () => {
  const calculator = new ProrataCalculator();

  it("should have correct metadata", () => {
    expect(calculator.name).toBe("Prorata");
    expect(calculator.order).toBe(15);
    expect(calculator.applicableTo).toEqual(["PKWTT", "PKWT"]);
  });

  it("should not adjust if employee started before period", () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        contractStart: new Date("2024-01-15"),
      },
      period: { start: new Date("2026-04-26"), end: new Date("2026-05-25") },
      previousLines: [
        buildLine({
          componentCode: "BASIC_SALARY",
          componentName: "Gaji Pokok",
          category: ComponentCategory.EARNING,
          amount: 8000000,
        }),
      ],
      metadata: {
        effectiveSalary: 8000000,
        dailyRate: 363636,
        hourlyRate: 46242,
      },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it("should prorate if employee started mid-period", () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        contractStart: new Date("2026-05-10"),
        basicSalary: 8000000,
      },
      period: { start: new Date("2026-05-01"), end: new Date("2026-05-31") },
      attendance: {
        ...createTestContext().attendance,
        totalWorkDays: 22,
        effectiveDays: 15,
      },
      previousLines: [
        buildLine({
          componentCode: "BASIC_SALARY",
          componentName: "Gaji Pokok",
          category: ComponentCategory.EARNING,
          amount: 8000000,
        }),
      ],
      metadata: {
        effectiveSalary: 8000000,
        dailyRate: 363636,
        hourlyRate: 46242,
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe("PRORATA_ADJUSTMENT");
    expect(result.lines[0].category).toBe(ComponentCategory.DEDUCTION);
    const expectedDeduction =
      8000000 - Math.floor(Math.floor(8000000 / 22) * 15);
    expect(result.lines[0].amount).toBe(expectedDeduction);
    expect(result.metadata?.prorataApplied).toBe(true);
  });
});
