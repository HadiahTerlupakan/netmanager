import { describe, it, expect } from "vitest";
import { ComponentCalculator } from "@/modules/salary/calculation/calculators/ComponentCalculator";
import { createTestContext } from "@/modules/salary/calculation/helpers/context-helpers";
import {
  ComponentCategory,
  ComponentCalculationType,
} from "@/modules/salary/core";
import type { EmployeeComponent } from "@/modules/salary/core";

describe("ComponentCalculator", () => {
  const calculator = new ComponentCalculator();

  it("should have correct metadata", () => {
    expect(calculator.name).toBe("Component");
    expect(calculator.order).toBe(40);
    expect(calculator.applicableTo).toBeNull();
  });

  it("should not generate lines if no components assigned", () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components: [] },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it("should calculate FIXED component", () => {
    const components: EmployeeComponent[] = [
      {
        componentId: "comp-1",
        componentCode: "ALW_TRANSPORT",
        componentName: "Tunjangan Transport",
        category: ComponentCategory.EARNING,
        calculationType: ComponentCalculationType.FIXED,
        amount: 500000,
        isActive: true,
      },
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(500000);
    expect(result.lines[0].componentCode).toBe("ALW_TRANSPORT");
  });

  it("should calculate PERCENTAGE component", () => {
    const components: EmployeeComponent[] = [
      {
        componentId: "comp-2",
        componentCode: "ALW_POSITION",
        componentName: "Tunjangan Jabatan",
        category: ComponentCategory.EARNING,
        calculationType: ComponentCalculationType.PERCENTAGE,
        amount: 10,
        isActive: true,
      },
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(800000);
  });

  it("should calculate PER_DAY component", () => {
    const components: EmployeeComponent[] = [
      {
        componentId: "comp-3",
        componentCode: "ALW_MEAL",
        componentName: "Uang Makan",
        category: ComponentCategory.EARNING,
        calculationType: ComponentCalculationType.PER_DAY,
        amount: 25000,
        isActive: true,
      },
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      attendance: { ...createTestContext().attendance, effectiveDays: 20 },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(500000);
    expect(result.lines[0].quantity).toBe(20);
  });

  it("should skip inactive components", () => {
    const components: EmployeeComponent[] = [
      {
        componentId: "comp-1",
        componentCode: "ALW_TRANSPORT",
        componentName: "Transport",
        category: ComponentCategory.EARNING,
        calculationType: ComponentCalculationType.FIXED,
        amount: 500000,
        isActive: false,
      },
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it("should handle deduction components", () => {
    const components: EmployeeComponent[] = [
      {
        componentId: "comp-4",
        componentCode: "DED_PARKING",
        componentName: "Potongan Parkir",
        category: ComponentCategory.DEDUCTION,
        calculationType: ComponentCalculationType.FIXED,
        amount: 100000,
        isActive: true,
      },
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].category).toBe(ComponentCategory.DEDUCTION);
  });
});
