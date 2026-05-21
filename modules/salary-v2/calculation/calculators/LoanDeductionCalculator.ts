import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  EmployeeType,
} from "@/modules/salary-v2/core";
import { ComponentCategory } from "@/modules/salary-v2/core";
import { buildLine } from "../helpers/line-builder";

interface ActiveLoan {
  id: string;
  name: string;
  installment: number;
  remainingAmount: number;
}

interface ActiveAdvance {
  id: string;
  amount: number;
  deductionMethod: "FULL_NEXT" | "INSTALLMENT";
  installmentCount?: number;
  remainingAmount: number;
}

export class LoanDeductionCalculator implements IPayrollCalculator {
  name = "LoanDeduction";
  order = 70;
  applicableTo: EmployeeType[] | null = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { metadata } = ctx;
    const lines = [];

    const activeLoans = (metadata.activeLoans as ActiveLoan[]) ?? [];
    for (const loan of activeLoans) {
      const amount = Math.min(loan.installment, loan.remainingAmount);
      if (amount > 0) {
        lines.push(
          buildLine({
            componentCode: `LOAN_${loan.id}`,
            componentName: `Cicilan: ${loan.name}`,
            category: ComponentCategory.DEDUCTION,
            amount,
            formula: `min(${loan.installment}, ${loan.remainingAmount})`,
            sortOrder: 50,
          }),
        );
      }
    }

    const activeAdvances = (metadata.activeAdvances as ActiveAdvance[]) ?? [];
    for (const advance of activeAdvances) {
      let amount: number;
      if (advance.deductionMethod === "FULL_NEXT") {
        amount = advance.remainingAmount;
      } else {
        const installmentAmount = Math.ceil(
          advance.amount / (advance.installmentCount ?? 1),
        );
        amount = Math.min(installmentAmount, advance.remainingAmount);
      }

      if (amount > 0) {
        lines.push(
          buildLine({
            componentCode: `ADVANCE_${advance.id}`,
            componentName: "Potongan Kasbon",
            category: ComponentCategory.DEDUCTION,
            amount,
            formula:
              advance.deductionMethod === "FULL_NEXT"
                ? `full: ${advance.remainingAmount}`
                : `installment: ${advance.amount} / ${advance.installmentCount}`,
            sortOrder: 51,
          }),
        );
      }
    }

    return { lines };
  }
}
