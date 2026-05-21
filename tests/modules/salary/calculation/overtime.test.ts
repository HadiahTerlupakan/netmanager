import { describe, it, expect } from "vitest";
import { OvertimeCalculator } from "@/modules/salary/calculation/calculators/OvertimeCalculator";
import { createTestContext } from "@/modules/salary/calculation/helpers/context-helpers";
import { ComponentCategory } from "@/modules/salary/core";

describe("OvertimeCalculator", () => {
  const calculator = new OvertimeCalculator();

  it("should have correct metadata", () => {
    expect(calculator.name).toBe("Overtime");
    expect(calculator.order).toBe(30);
    expect(calculator.applicableTo).toBeNull();
  });

  it("should not generate lines if no overtime", () => {
    const ctx = createTestContext({
      overtime: {
        normalMinutes: 0,
        holidayMinutes: 0,
        nationalHolidayMinutes: 0,
        totalMinutes: 0,
      },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it("should skip if employee not overtime eligible", () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, overtimeEligible: false },
      overtime: {
        normalMinutes: 120,
        holidayMinutes: 0,
        nationalHolidayMinutes: 0,
        totalMinutes: 120,
      },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it("should calculate workday overtime with tiered multipliers", () => {
    const ctx = createTestContext({
      overtime: {
        normalMinutes: 150,
        holidayMinutes: 0,
        nationalHolidayMinutes: 0,
        totalMinutes: 150,
      },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe("OVERTIME");
    expect(result.lines[0].category).toBe(ComponentCategory.EARNING);

    // First hour: 1 × 1.5 × 46242
    const firstHour = Math.floor(1 * 1.5 * 46242);
    // Remaining 1.5 hours: 1.5 × 2 × 46242
    const remaining = Math.floor(1.5 * 2 * 46242);
    expect(result.lines[0].amount).toBe(firstHour + remaining);
  });

  it("should calculate holiday overtime with tiered multipliers", () => {
    const ctx = createTestContext({
      overtime: {
        normalMinutes: 0,
        holidayMinutes: 540,
        nationalHolidayMinutes: 0,
        totalMinutes: 540,
      },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    // 9 hours total: first 7 at 2x, hour 8 at 3x, hour 9 at 4x
    const first7 = Math.floor(7 * 2 * 46242);
    const hour8 = Math.floor(1 * 3 * 46242);
    const hour9 = Math.floor(1 * 4 * 46242);
    expect(result.lines[0].amount).toBe(first7 + hour8 + hour9);
  });

  it("should calculate national holiday overtime", () => {
    const ctx = createTestContext({
      overtime: {
        normalMinutes: 0,
        holidayMinutes: 0,
        nationalHolidayMinutes: 420,
        totalMinutes: 420,
      },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    // 7 hours total: first 5 at 2x, hour 6 at 3x, hour 7 at 4x
    const first5 = Math.floor(5 * 2 * 46242);
    const hour6 = Math.floor(1 * 3 * 46242);
    const hour7 = Math.floor(1 * 4 * 46242);
    expect(result.lines[0].amount).toBe(first5 + hour6 + hour7);
  });

  it("should combine all overtime types into one line", () => {
    const ctx = createTestContext({
      overtime: {
        normalMinutes: 60,
        holidayMinutes: 60,
        nationalHolidayMinutes: 60,
        totalMinutes: 180,
      },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe("OVERTIME");
  });
});
