import type { ProgressiveRate } from "@/modules/salary-v2/core";

export interface AnnualCorrectionInput {
  annualPkp: number;
  progressiveRates: ProgressiveRate[];
  totalTaxPaidYtd: number;
  hasNpwp: boolean;
  npwpSurcharge: number;
}

export interface AnnualCorrectionResult {
  annualTaxDue: number;
  correctionAmount: number;
}

export interface PartialYearInput {
  totalGrossIncome: number;
  totalBiayaJabatan: number;
  totalBpjsEmployee: number;
  ptkpAnnual: number;
  progressiveRates: ProgressiveRate[];
  totalTaxPaidYtd: number;
  monthsWorked: number;
  hasNpwp: boolean;
  npwpSurcharge: number;
}

export interface PartialYearResult {
  annualTaxDue: number;
  finalMonthTax: number;
}

export class ProgressiveAnnualStrategy {
  calculateAnnualTax(
    annualPkp: number,
    progressiveRates: ProgressiveRate[],
  ): number {
    if (annualPkp <= 0) return 0;

    let remaining = annualPkp;
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

  calculateAnnualCorrection(
    input: AnnualCorrectionInput,
  ): AnnualCorrectionResult {
    let annualTaxDue = this.calculateAnnualTax(
      input.annualPkp,
      input.progressiveRates,
    );

    if (!input.hasNpwp) {
      annualTaxDue = Math.floor(annualTaxDue * (1 + input.npwpSurcharge));
    }

    const correctionAmount = annualTaxDue - input.totalTaxPaidYtd;

    return { annualTaxDue, correctionAmount };
  }

  calculatePartialYearTax(input: PartialYearInput): PartialYearResult {
    const pkp =
      input.totalGrossIncome -
      input.totalBiayaJabatan -
      input.totalBpjsEmployee -
      input.ptkpAnnual;

    let annualTaxDue = this.calculateAnnualTax(
      Math.max(0, pkp),
      input.progressiveRates,
    );

    if (!input.hasNpwp) {
      annualTaxDue = Math.floor(annualTaxDue * (1 + input.npwpSurcharge));
    }

    const finalMonthTax = annualTaxDue - input.totalTaxPaidYtd;

    return { annualTaxDue, finalMonthTax };
  }
}
