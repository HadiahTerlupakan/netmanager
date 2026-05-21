import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  EmployeeType,
} from "@/modules/salary/core";
import { ComponentCategory } from "@/modules/salary/core";
import { buildLine } from "../helpers/line-builder";

export class ProrataCalculator implements IPayrollCalculator {
  name = "Prorata";
  order = 15;
  applicableTo: EmployeeType[] = ["PKWTT", "PKWT"];

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, period, attendance, metadata } = ctx;

    const periodStart = period.start;
    const contractStart = employee.contractStart;

    if (contractStart <= periodStart) {
      return { lines: [] };
    }

    const effectiveSalary =
      (metadata.effectiveSalary as number) ?? employee.basicSalary;
    const totalWorkDays = attendance.totalWorkDays;
    const effectiveDays = attendance.effectiveDays;

    const dailyRate = Math.floor(effectiveSalary / totalWorkDays);
    const proratedSalary = Math.floor(dailyRate * effectiveDays);
    const deduction = effectiveSalary - proratedSalary;

    if (deduction <= 0) {
      return { lines: [] };
    }

    return {
      lines: [
        buildLine({
          componentCode: "PRORATA_ADJUSTMENT",
          componentName: "Penyesuaian Prorata",
          category: ComponentCategory.DEDUCTION,
          quantity: totalWorkDays - effectiveDays,
          rate: dailyRate,
          amount: deduction,
          formula: `${effectiveSalary} - (${dailyRate} × ${effectiveDays})`,
          sortOrder: 2,
        }),
      ],
      metadata: {
        prorataApplied: true,
        effectiveSalary: proratedSalary,
        dailyRate,
      },
    };
  }
}
