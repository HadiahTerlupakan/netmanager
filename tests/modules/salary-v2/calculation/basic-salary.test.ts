import { describe, it, expect } from "vitest";
import { BasicSalaryCalculator } from "@/modules/salary-v2/calculation/calculators/BasicSalaryCalculator";
import { createTestContext } from "@/modules/salary-v2/calculation/helpers/context-helpers";
import { ComponentCategory } from "@/modules/salary-v2/core";

describe("BasicSalaryCalculator", () => {
  const calculator = new BasicSalaryCalculator();

  it("should have correct metadata", () => {
    expect(calculator.name).toBe("BasicSalary");
    expect(calculator.order).toBe(10);
    expect(calculator.applicableTo).toBeNull();
  });

  it("should generate basic salary line for full month", () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, basicSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe("BASIC_SALARY");
    expect(result.lines[0].componentName).toBe("Gaji Pokok");
    expect(result.lines[0].category).toBe(ComponentCategory.EARNING);
    expect(result.lines[0].amount).toBe(8000000);
    expect(result.lines[0].quantity).toBe(1);
    expect(result.lines[0].rate).toBe(8000000);
  });

  it("should store effectiveSalary in metadata", () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, basicSalary: 10000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.metadata?.effectiveSalary).toBe(10000000);
    expect(result.metadata?.dailyRate).toBe(Math.floor(10000000 / 22));
    expect(result.metadata?.hourlyRate).toBe(Math.floor(10000000 / 173));
  });

  it("should handle DAILY employee type (pay per effective day)", () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        employeeType: "DAILY",
        basicSalary: 300000,
      },
      attendance: {
        ...createTestContext().attendance,
        effectiveDays: 18,
        totalWorkDays: 22,
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines[0].amount).toBe(5400000);
    expect(result.lines[0].quantity).toBe(18);
    expect(result.lines[0].rate).toBe(300000);
    expect(result.metadata?.effectiveSalary).toBe(5400000);
  });
});
