import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  EmployeeType,
} from "@/modules/salary/core";
import {
  sumEarnings,
  sumDeductions,
  sumTax,
  sumEmployerCost,
} from "../helpers/line-builder";

export class NetSalaryCalculator implements IPayrollCalculator {
  name = "NetSalary";
  order = 99;
  applicableTo: EmployeeType[] | null = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { previousLines } = ctx;

    const totalEarnings = sumEarnings(previousLines);
    const totalDeductions = sumDeductions(previousLines);
    const totalTax = sumTax(previousLines);
    const totalEmployerCost = sumEmployerCost(previousLines);
    const netSalary = totalEarnings - totalDeductions - totalTax;

    return {
      lines: [],
      metadata: {
        totalEarnings,
        totalDeductions,
        totalTax,
        netSalary,
        totalEmployerCost,
        isNegative: netSalary < 0,
      },
    };
  }
}
