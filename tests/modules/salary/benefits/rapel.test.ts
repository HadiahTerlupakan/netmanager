import { describe, it, expect } from "vitest";
import { RapelCalculationService } from "@/modules/salary/benefits/rapel/RapelCalculationService";
import type { RapelInput } from "@/modules/salary/benefits/rapel/RapelCalculationService";

describe("RapelCalculationService", () => {
  const service = new RapelCalculationService();

  it("should calculate rapel for salary increase", () => {
    const input: RapelInput = {
      reason: "SALARY_INCREASE",
      newBasicSalary: 10000000,
      affectedPeriods: [
        { month: 1, year: 2026, paidAmount: 8000000 },
        { month: 2, year: 2026, paidAmount: 8000000 },
        { month: 3, year: 2026, paidAmount: 8000000 },
      ],
    };

    const result = service.calculate(input);

    expect(result.totalDifference).toBe(6000000);
    expect(result.periodDetails).toHaveLength(3);
    expect(result.periodDetails[0].difference).toBe(2000000);
    expect(result.periodDetails[1].difference).toBe(2000000);
    expect(result.periodDetails[2].difference).toBe(2000000);
  });

  it("should calculate rapel for correction", () => {
    const input: RapelInput = {
      reason: "CORRECTION",
      newBasicSalary: 8000000,
      affectedPeriods: [{ month: 3, year: 2026, paidAmount: 7500000 }],
    };

    const result = service.calculate(input);

    expect(result.totalDifference).toBe(500000);
    expect(result.periodDetails).toHaveLength(1);
  });

  it("should handle zero difference", () => {
    const input: RapelInput = {
      reason: "SALARY_INCREASE",
      newBasicSalary: 8000000,
      affectedPeriods: [{ month: 1, year: 2026, paidAmount: 8000000 }],
    };

    const result = service.calculate(input);
    expect(result.totalDifference).toBe(0);
  });

  it("should handle negative difference (overpayment)", () => {
    const input: RapelInput = {
      reason: "CORRECTION",
      newBasicSalary: 7000000,
      affectedPeriods: [{ month: 1, year: 2026, paidAmount: 8000000 }],
    };

    const result = service.calculate(input);
    expect(result.totalDifference).toBe(-1000000);
    expect(result.hasOverpayment).toBe(true);
  });

  it("should calculate with custom corrected amounts per period", () => {
    const input: RapelInput = {
      reason: "CORRECTION",
      affectedPeriods: [
        { month: 1, year: 2026, paidAmount: 8000000, correctedAmount: 8500000 },
        { month: 2, year: 2026, paidAmount: 8000000, correctedAmount: 9000000 },
      ],
    };

    const result = service.calculate(input);
    expect(result.totalDifference).toBe(1500000);
    expect(result.periodDetails[0].difference).toBe(500000);
    expect(result.periodDetails[1].difference).toBe(1000000);
  });
});
