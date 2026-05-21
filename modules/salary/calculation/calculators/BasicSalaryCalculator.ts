import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  EmployeeType,
} from "@/modules/salary/core";
import { ComponentCategory } from "@/modules/salary/core";
import { buildLine } from "../helpers/line-builder";

export class BasicSalaryCalculator implements IPayrollCalculator {
  name = "BasicSalary";
  order = 10;
  applicableTo: EmployeeType[] | null = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, attendance } = ctx;
    const isDaily = employee.employeeType === "DAILY";

    let amount: number;
    let quantity: number;
    let rate: number;

    if (isDaily) {
      rate = employee.basicSalary;
      quantity = attendance.effectiveDays;
      amount = Math.floor(rate * quantity);
    } else {
      rate = employee.basicSalary;
      quantity = 1;
      amount = employee.basicSalary;
    }

    const effectiveSalary = amount;
    const dailyRate = Math.floor(effectiveSalary / attendance.totalWorkDays);
    const hourlyRate = Math.floor(employee.basicSalary / 173);

    return {
      lines: [
        buildLine({
          componentCode: "BASIC_SALARY",
          componentName: "Gaji Pokok",
          category: ComponentCategory.EARNING,
          quantity,
          rate,
          amount,
          formula: isDaily ? `${rate} × ${quantity} hari` : "basicSalary",
          sortOrder: 1,
        }),
      ],
      metadata: { effectiveSalary, dailyRate, hourlyRate },
    };
  }
}
