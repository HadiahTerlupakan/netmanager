import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  OvertimeTier,
} from "@/modules/salary/core";
import { ComponentCategory, OvertimeDayType } from "@/modules/salary/core";
import type { EmployeeType } from "@/modules/salary/core";
import { buildLine } from "../helpers/line-builder";

export class OvertimeCalculator implements IPayrollCalculator {
  name = "Overtime";
  order = 30;
  applicableTo: EmployeeType[] | null = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, overtime, metadata, config } = ctx;

    if (!employee.overtimeEligible || overtime.totalMinutes === 0) {
      return { lines: [] };
    }

    const hourlyRate =
      (metadata.hourlyRate as number) ?? Math.floor(employee.basicSalary / 173);
    const overtimeConfig = config.overtime;

    let totalAmount = 0;

    if (overtime.normalMinutes > 0) {
      totalAmount += this.calculateTiered(
        overtime.normalMinutes / 60,
        hourlyRate,
        overtimeConfig.tiers,
        OvertimeDayType.WORKDAY,
      );
    }

    if (overtime.holidayMinutes > 0) {
      totalAmount += this.calculateTiered(
        overtime.holidayMinutes / 60,
        hourlyRate,
        overtimeConfig.tiers,
        OvertimeDayType.HOLIDAY,
      );
    }

    if (overtime.nationalHolidayMinutes > 0) {
      totalAmount += this.calculateTiered(
        overtime.nationalHolidayMinutes / 60,
        hourlyRate,
        overtimeConfig.tiers,
        OvertimeDayType.NATIONAL_HOLIDAY,
      );
    }

    if (totalAmount === 0) {
      return { lines: [] };
    }

    return {
      lines: [
        buildLine({
          componentCode: "OVERTIME",
          componentName: "Lembur",
          category: ComponentCategory.EARNING,
          quantity: overtime.totalMinutes / 60,
          rate: hourlyRate,
          amount: totalAmount,
          formula: `tiered(normal=${overtime.normalMinutes}m, holiday=${overtime.holidayMinutes}m, national=${overtime.nationalHolidayMinutes}m)`,
          sortOrder: 5,
        }),
      ],
      metadata: { overtimeAmount: totalAmount },
    };
  }

  private calculateTiered(
    hours: number,
    hourlyRate: number,
    tiers: OvertimeTier[],
    dayType: string,
  ): number {
    const applicableTiers = tiers
      .filter((t) => t.dayType === dayType)
      .sort((a, b) => a.fromHour - b.fromHour);

    let total = 0;
    let remainingHours = hours;

    for (const tier of applicableTiers) {
      if (remainingHours <= 0) break;

      const tierHours =
        tier.toHour !== null
          ? Math.min(remainingHours, tier.toHour - tier.fromHour)
          : remainingHours;

      total += Math.floor(tierHours * tier.multiplier * hourlyRate);
      remainingHours -= tierHours;
    }

    return total;
  }
}
