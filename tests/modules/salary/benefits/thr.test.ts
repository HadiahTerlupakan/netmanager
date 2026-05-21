import { describe, it, expect } from "vitest";
import { ThrCalculationService } from "@/modules/salary/benefits/thr/ThrCalculationService";
import type { ThrConfig } from "@/modules/salary/core";

const defaultThrConfig: ThrConfig = {
  eligibleAfterMonths: 1,
  fullEntitlementMonths: 12,
  prorata: true,
  components: ["BASIC_SALARY"],
  paymentDeadlineDays: 7,
};

describe("ThrCalculationService", () => {
  const service = new ThrCalculationService();

  it("should calculate full THR for employee with >= 12 months tenure", () => {
    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 1000000,
      contractStart: new Date("2024-01-15"),
      calculationDate: new Date("2026-03-20"),
      config: defaultThrConfig,
    });

    expect(result.amount).toBe(8000000);
    expect(result.isProrated).toBe(false);
    expect(result.monthsWorked).toBeGreaterThanOrEqual(12);
  });

  it("should calculate prorated THR for employee with < 12 months tenure", () => {
    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 1000000,
      contractStart: new Date("2025-09-15"),
      calculationDate: new Date("2026-03-20"),
      config: defaultThrConfig,
    });

    expect(result.isProrated).toBe(true);
    expect(result.monthsWorked).toBe(6);
    expect(result.amount).toBe(Math.floor(8000000 * (6 / 12)));
  });

  it("should return 0 if employee tenure < eligibleAfterMonths", () => {
    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 0,
      contractStart: new Date("2026-03-10"),
      calculationDate: new Date("2026-03-20"),
      config: defaultThrConfig,
    });

    expect(result.amount).toBe(0);
    expect(result.eligible).toBe(false);
  });

  it("should include fixed allowances when configured", () => {
    const configWithAllowances: ThrConfig = {
      ...defaultThrConfig,
      components: ["BASIC_SALARY", "FIXED_ALLOWANCES"],
    };

    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 1500000,
      contractStart: new Date("2024-01-15"),
      calculationDate: new Date("2026-03-20"),
      config: configWithAllowances,
    });

    expect(result.amount).toBe(9500000);
  });

  it("should not prorate if prorata is disabled", () => {
    const configNoProrata: ThrConfig = {
      ...defaultThrConfig,
      prorata: false,
    };

    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 0,
      contractStart: new Date("2025-09-15"),
      calculationDate: new Date("2026-03-20"),
      config: configNoProrata,
    });

    expect(result.amount).toBe(8000000);
    expect(result.isProrated).toBe(false);
  });

  it("should calculate months worked correctly", () => {
    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 0,
      contractStart: new Date("2025-06-01"),
      calculationDate: new Date("2026-03-20"),
      config: defaultThrConfig,
    });

    expect(result.monthsWorked).toBe(9);
  });
});
