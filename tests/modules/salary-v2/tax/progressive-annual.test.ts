import { describe, it, expect } from "vitest";
import { ProgressiveAnnualStrategy } from "@/modules/salary-v2/tax/strategies/ProgressiveAnnualStrategy";
import { DEFAULT_TAX_CONFIG } from "@/modules/salary-v2/core";

describe("ProgressiveAnnualStrategy", () => {
  const strategy = new ProgressiveAnnualStrategy();
  const progressiveRates = DEFAULT_TAX_CONFIG.progressiveRates;

  it("should calculate annual tax for income in first bracket only", () => {
    const tax = strategy.calculateAnnualTax(50000000, progressiveRates);
    expect(tax).toBe(2500000);
  });

  it("should calculate annual tax spanning two brackets", () => {
    const tax = strategy.calculateAnnualTax(100000000, progressiveRates);
    expect(tax).toBe(9000000);
  });

  it("should calculate annual tax spanning three brackets", () => {
    const tax = strategy.calculateAnnualTax(300000000, progressiveRates);
    expect(tax).toBe(44000000);
  });

  it("should return 0 for zero or negative PKP", () => {
    expect(strategy.calculateAnnualTax(0, progressiveRates)).toBe(0);
    expect(strategy.calculateAnnualTax(-5000000, progressiveRates)).toBe(0);
  });

  it("should calculate annual correction (December)", () => {
    const result = strategy.calculateAnnualCorrection({
      annualPkp: 100000000,
      progressiveRates,
      totalTaxPaidYtd: 7500000,
      hasNpwp: true,
      npwpSurcharge: 0.2,
    });
    expect(result.annualTaxDue).toBe(9000000);
    expect(result.correctionAmount).toBe(1500000);
  });

  it("should handle overpayment (negative correction)", () => {
    const result = strategy.calculateAnnualCorrection({
      annualPkp: 100000000,
      progressiveRates,
      totalTaxPaidYtd: 10000000,
      hasNpwp: true,
      npwpSurcharge: 0.2,
    });
    expect(result.correctionAmount).toBe(-1000000);
  });

  it("should apply NPWP surcharge to annual tax", () => {
    const withNpwp = strategy.calculateAnnualCorrection({
      annualPkp: 100000000,
      progressiveRates,
      totalTaxPaidYtd: 0,
      hasNpwp: true,
      npwpSurcharge: 0.2,
    });
    const withoutNpwp = strategy.calculateAnnualCorrection({
      annualPkp: 100000000,
      progressiveRates,
      totalTaxPaidYtd: 0,
      hasNpwp: false,
      npwpSurcharge: 0.2,
    });
    expect(withoutNpwp.annualTaxDue).toBe(
      Math.floor(withNpwp.annualTaxDue * 1.2),
    );
  });

  it("should calculate for partial year (resign scenario)", () => {
    const result = strategy.calculatePartialYearTax({
      totalGrossIncome: 80000000,
      totalBiayaJabatan: 4000000,
      totalBpjsEmployee: 2400000,
      ptkpAnnual: 54000000,
      progressiveRates,
      totalTaxPaidYtd: 1500000,
      monthsWorked: 8,
      hasNpwp: true,
      npwpSurcharge: 0.2,
    });

    const pkp = 80000000 - 4000000 - 2400000 - 54000000;
    const expectedAnnualTax = strategy.calculateAnnualTax(
      pkp,
      progressiveRates,
    );
    expect(result.annualTaxDue).toBe(expectedAnnualTax);
    expect(result.finalMonthTax).toBe(expectedAnnualTax - 1500000);
  });
});
