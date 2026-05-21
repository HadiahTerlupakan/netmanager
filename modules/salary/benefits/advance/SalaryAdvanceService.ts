import type { SalaryAdvancePolicy } from "@/modules/salary/core";

export type ValidationError =
  | "EXCEEDS_MAX_PERCENT"
  | "MAX_ACTIVE_EXCEEDED"
  | "TOO_SOON";

export interface ValidateRequestInput {
  requestedAmount: number;
  basicSalary: number;
  activeAdvanceCount: number;
  lastRequestDate: Date | null;
  requestDate: Date;
  policy: SalaryAdvancePolicy;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  maxAllowed?: number;
}

export interface DeductionInput {
  amount: number;
  remainingAmount: number;
  deductionMethod: "FULL_NEXT" | "INSTALLMENT";
  installmentCount: number | null;
}

export interface DeductionResult {
  deductionAmount: number;
}

export class SalaryAdvanceService {
  validateRequest(input: ValidateRequestInput): ValidationResult {
    const {
      requestedAmount,
      basicSalary,
      activeAdvanceCount,
      lastRequestDate,
      requestDate,
      policy,
    } = input;
    const errors: ValidationError[] = [];

    const maxAllowed = Math.floor(basicSalary * policy.maxPercentOfSalary);
    if (requestedAmount > maxAllowed) {
      errors.push("EXCEEDS_MAX_PERCENT");
    }

    if (activeAdvanceCount >= policy.maxActiveAdvances) {
      errors.push("MAX_ACTIVE_EXCEEDED");
    }

    if (lastRequestDate) {
      const daysSinceLastRequest = Math.floor(
        (requestDate.getTime() - lastRequestDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSinceLastRequest < policy.minDaysBetweenRequests) {
        errors.push("TOO_SOON");
      }
    }

    return { valid: errors.length === 0, errors, maxAllowed };
  }

  calculateDeduction(input: DeductionInput): DeductionResult {
    const { amount, remainingAmount, deductionMethod, installmentCount } =
      input;

    let deductionAmount: number;

    if (deductionMethod === "FULL_NEXT") {
      deductionAmount = remainingAmount;
    } else {
      const perInstallment = Math.ceil(amount / (installmentCount ?? 1));
      deductionAmount = Math.min(perInstallment, remainingAmount);
    }

    return { deductionAmount };
  }
}
