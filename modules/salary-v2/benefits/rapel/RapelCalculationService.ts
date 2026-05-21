export type RapelReason =
  | "SALARY_INCREASE"
  | "CORRECTION"
  | "RETROACTIVE_COMPONENT";

export interface PeriodPayment {
  month: number;
  year: number;
  paidAmount: number;
  correctedAmount?: number;
}

export interface RapelInput {
  reason: RapelReason;
  newBasicSalary?: number;
  affectedPeriods: PeriodPayment[];
}

export interface PeriodDetail {
  month: number;
  year: number;
  originalAmount: number;
  correctedAmount: number;
  difference: number;
}

export interface RapelResult {
  totalDifference: number;
  periodDetails: PeriodDetail[];
  hasOverpayment: boolean;
  reason: RapelReason;
}

export class RapelCalculationService {
  calculate(input: RapelInput): RapelResult {
    const { reason, newBasicSalary, affectedPeriods } = input;

    const periodDetails: PeriodDetail[] = affectedPeriods.map((period) => {
      const correctedAmount =
        period.correctedAmount ?? newBasicSalary ?? period.paidAmount;
      const difference = correctedAmount - period.paidAmount;

      return {
        month: period.month,
        year: period.year,
        originalAmount: period.paidAmount,
        correctedAmount,
        difference,
      };
    });

    const totalDifference = periodDetails.reduce(
      (sum, p) => sum + p.difference,
      0,
    );
    const hasOverpayment = totalDifference < 0;

    return { totalDifference, periodDetails, hasOverpayment, reason };
  }
}
