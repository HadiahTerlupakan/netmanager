import type { ThrConfig } from "@/modules/salary-v2/core";

export interface ThrInput {
  basicSalary: number;
  fixedAllowances: number;
  contractStart: Date;
  calculationDate: Date;
  config: ThrConfig;
}

export interface ThrResult {
  amount: number;
  eligible: boolean;
  isProrated: boolean;
  monthsWorked: number;
  baseAmount: number;
}

export class ThrCalculationService {
  calculate(input: ThrInput): ThrResult {
    const {
      basicSalary,
      fixedAllowances,
      contractStart,
      calculationDate,
      config,
    } = input;

    const monthsWorked = this.calculateMonthsWorked(
      contractStart,
      calculationDate,
    );

    if (monthsWorked < config.eligibleAfterMonths) {
      return {
        amount: 0,
        eligible: false,
        isProrated: false,
        monthsWorked,
        baseAmount: 0,
      };
    }

    let baseAmount = basicSalary;
    if (config.components.includes("FIXED_ALLOWANCES")) {
      baseAmount += fixedAllowances;
    }

    let amount: number;
    let isProrated: boolean;

    if (monthsWorked >= config.fullEntitlementMonths) {
      amount = baseAmount;
      isProrated = false;
    } else if (config.prorata) {
      amount = Math.floor(
        baseAmount * (monthsWorked / config.fullEntitlementMonths),
      );
      isProrated = true;
    } else {
      amount = baseAmount;
      isProrated = false;
    }

    return { amount, eligible: true, isProrated, monthsWorked, baseAmount };
  }

  private calculateMonthsWorked(
    contractStart: Date,
    calculationDate: Date,
  ): number {
    const years = calculationDate.getFullYear() - contractStart.getFullYear();
    const months = calculationDate.getMonth() - contractStart.getMonth();
    const totalMonths = years * 12 + months;
    return Math.max(0, totalMonths);
  }
}
