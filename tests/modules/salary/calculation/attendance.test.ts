import { describe, it, expect } from "vitest";
import { AttendanceCalculator } from "@/modules/salary/calculation/calculators/AttendanceCalculator";
import { createTestContext } from "@/modules/salary/calculation/helpers/context-helpers";
import { ComponentCategory } from "@/modules/salary/core";

describe("AttendanceCalculator", () => {
  const calculator = new AttendanceCalculator();

  it("should have correct metadata", () => {
    expect(calculator.name).toBe("Attendance");
    expect(calculator.order).toBe(20);
    expect(calculator.applicableTo).toBeNull();
  });

  it("should not deduct if no absences", () => {
    const ctx = createTestContext({
      attendance: {
        totalWorkDays: 22,
        presentDays: 22,
        absentDays: 0,
        lateDays: 0,
        sickDays: 0,
        permitDays: 0,
        effectiveDays: 22,
      },
      metadata: { effectiveSalary: 8000000, dailyRate: 363636 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it("should deduct for absent days (alpha)", () => {
    const ctx = createTestContext({
      attendance: {
        totalWorkDays: 22,
        presentDays: 19,
        absentDays: 3,
        lateDays: 0,
        sickDays: 0,
        permitDays: 0,
        effectiveDays: 19,
      },
      metadata: { effectiveSalary: 8000000, dailyRate: 363636 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe("ABSENT_DEDUCTION");
    expect(result.lines[0].category).toBe(ComponentCategory.DEDUCTION);
    expect(result.lines[0].amount).toBe(363636 * 3);
    expect(result.lines[0].quantity).toBe(3);
  });

  it("should deduct for late days if threshold exceeded", () => {
    const ctx = createTestContext({
      attendance: {
        totalWorkDays: 22,
        presentDays: 22,
        absentDays: 0,
        lateDays: 4,
        sickDays: 0,
        permitDays: 0,
        effectiveDays: 22,
      },
      metadata: { effectiveSalary: 8000000, dailyRate: 363636 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe("LATE_DEDUCTION");
    expect(result.lines[0].amount).toBe(Math.floor(363636 * 0.5) * 4);
  });

  it("should not deduct for late if within threshold (3 or fewer)", () => {
    const ctx = createTestContext({
      attendance: {
        totalWorkDays: 22,
        presentDays: 22,
        absentDays: 0,
        lateDays: 3,
        sickDays: 0,
        permitDays: 0,
        effectiveDays: 22,
      },
      metadata: { effectiveSalary: 8000000, dailyRate: 363636 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });
});
