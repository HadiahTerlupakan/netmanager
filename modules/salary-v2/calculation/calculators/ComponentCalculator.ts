import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  EmployeeComponent,
} from "@/modules/salary-v2/core";
import { ComponentCalculationType } from "@/modules/salary-v2/core";
import type { EmployeeType } from "@/modules/salary-v2/core";
import { buildLine } from "../helpers/line-builder";

export class ComponentCalculator implements IPayrollCalculator {
  name = "Component";
  order = 40;
  applicableTo: EmployeeType[] | null = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, attendance, metadata } = ctx;
    const effectiveSalary =
      (metadata.effectiveSalary as number) ?? employee.basicSalary;
    const lines = [];

    const activeComponents = employee.components.filter((c) => c.isActive);

    for (const comp of activeComponents) {
      const line = this.calculateComponent(
        comp,
        effectiveSalary,
        attendance.effectiveDays,
      );
      if (line) {
        lines.push(line);
      }
    }

    return { lines };
  }

  private calculateComponent(
    comp: EmployeeComponent,
    effectiveSalary: number,
    effectiveDays: number,
  ) {
    const baseAmount = comp.amount ?? 0;

    let amount: number;
    let quantity = 1;
    let rate = baseAmount;
    let formula: string;

    switch (comp.calculationType) {
      case ComponentCalculationType.FIXED:
        amount = baseAmount;
        formula = `fixed: ${baseAmount}`;
        break;

      case ComponentCalculationType.PERCENTAGE:
        amount = Math.floor(effectiveSalary * (baseAmount / 100));
        rate = baseAmount;
        formula = `${effectiveSalary} × ${baseAmount}%`;
        break;

      case ComponentCalculationType.PER_DAY:
        quantity = effectiveDays;
        amount = Math.floor(baseAmount * effectiveDays);
        formula = `${baseAmount} × ${effectiveDays} hari`;
        break;

      case ComponentCalculationType.PER_HOUR:
        amount = baseAmount;
        formula = `per_hour: ${baseAmount}`;
        break;

      case ComponentCalculationType.PER_UNIT:
        amount = baseAmount;
        formula = `per_unit: ${baseAmount}`;
        break;

      default:
        amount = baseAmount;
        formula = `unknown: ${baseAmount}`;
    }

    if (amount === 0) return null;

    return buildLine({
      componentId: comp.componentId,
      componentCode: comp.componentCode,
      componentName: comp.componentName,
      category: comp.category,
      quantity,
      rate,
      amount,
      formula,
      sortOrder: 20,
    });
  }
}
