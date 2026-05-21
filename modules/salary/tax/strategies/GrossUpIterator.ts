import type { ProgressiveRate } from "@/modules/salary/core";

export interface GrossUpInput {
  baseGrossIncome: number;
  biayaJabatan: number;
  bpjsEmployeeDeduction: number;
  ptkpMonthly: number;
  progressiveRates: ProgressiveRate[];
  hasNpwp: boolean;
  npwpSurcharge: number;
}

export interface GrossUpResult {
  taxAllowance: number;
  totalTax: number;
  iterations: number;
  converged: boolean;
}

const MAX_ITERATIONS = 20;
const CONVERGENCE_THRESHOLD = 1;

export class GrossUpIterator {
  calculate(input: GrossUpInput): GrossUpResult {
    const {
      baseGrossIncome,
      biayaJabatan,
      bpjsEmployeeDeduction,
      ptkpMonthly,
      progressiveRates,
      hasNpwp,
      npwpSurcharge,
    } = input;

    let taxAllowance = 0;
    let previousTax = 0;
    let iterations = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      iterations = i + 1;

      const grossWithAllowance = baseGrossIncome + taxAllowance;
      const taxableIncome =
        grossWithAllowance - biayaJabatan - bpjsEmployeeDeduction - ptkpMonthly;

      if (taxableIncome <= 0) {
        return { taxAllowance: 0, totalTax: 0, iterations, converged: true };
      }

      const annualizedTaxable = taxableIncome * 12;
      let annualTax = this.calculateProgressiveTax(
        annualizedTaxable,
        progressiveRates,
      );

      if (!hasNpwp) {
        annualTax = Math.floor(annualTax * (1 + npwpSurcharge));
      }

      const monthlyTax = Math.floor(annualTax / 12);

      if (Math.abs(monthlyTax - previousTax) <= CONVERGENCE_THRESHOLD) {
        return {
          taxAllowance: monthlyTax,
          totalTax: monthlyTax,
          iterations,
          converged: true,
        };
      }

      previousTax = monthlyTax;
      taxAllowance = monthlyTax;
    }

    return {
      taxAllowance: previousTax,
      totalTax: previousTax,
      iterations,
      converged: false,
    };
  }

  private calculateProgressiveTax(
    annualTaxable: number,
    progressiveRates: ProgressiveRate[],
  ): number {
    let remaining = annualTaxable;
    let totalTax = 0;

    for (const bracket of progressiveRates) {
      if (remaining <= 0) break;

      const bracketSize =
        bracket.maxAmount !== null
          ? bracket.maxAmount - bracket.minAmount
          : remaining;

      const taxableInBracket = Math.min(remaining, bracketSize);
      totalTax += Math.floor(taxableInBracket * bracket.rate);
      remaining -= taxableInBracket;
    }

    return totalTax;
  }
}
