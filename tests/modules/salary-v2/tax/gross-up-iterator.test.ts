import { describe, it, expect } from "vitest";
import { GrossUpIterator } from "@/modules/salary-v2/tax/strategies/GrossUpIterator";
import { DEFAULT_TAX_CONFIG } from "@/modules/salary-v2/core";

describe("GrossUpIterator", () => {
  const iterator = new GrossUpIterator();

  it("should converge to correct gross-up amount", () => {
    const result = iterator.calculate({
      baseGrossIncome: 10000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 320000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.2,
    });

    expect(result.taxAllowance).toBeGreaterThan(0);
    expect(result.totalTax).toBe(result.taxAllowance);
    expect(result.iterations).toBeLessThanOrEqual(5);
    expect(result.converged).toBe(true);
  });

  it("should produce tax allowance equal to final tax", () => {
    const result = iterator.calculate({
      baseGrossIncome: 15000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 480000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.2,
    });

    expect(result.taxAllowance).toBe(result.totalTax);
  });

  it("should apply NPWP surcharge in gross-up", () => {
    const withNpwp = iterator.calculate({
      baseGrossIncome: 10000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 320000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.2,
    });
    const withoutNpwp = iterator.calculate({
      baseGrossIncome: 10000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 320000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: false,
      npwpSurcharge: 0.2,
    });

    expect(withoutNpwp.taxAllowance).toBeGreaterThan(withNpwp.taxAllowance);
  });

  it("should return zero if income below PTKP", () => {
    const result = iterator.calculate({
      baseGrossIncome: 4000000,
      biayaJabatan: 200000,
      bpjsEmployeeDeduction: 120000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.2,
    });

    expect(result.taxAllowance).toBe(0);
    expect(result.totalTax).toBe(0);
  });

  it("should converge for high income", () => {
    const result = iterator.calculate({
      baseGrossIncome: 50000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 480000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.2,
    });

    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(15);
  });
});
