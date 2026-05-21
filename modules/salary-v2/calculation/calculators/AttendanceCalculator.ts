import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  EmployeeType,
} from "@/modules/salary-v2/core";
import { ComponentCategory } from "@/modules/salary-v2/core";
import { buildLine } from "../helpers/line-builder";

const LATE_THRESHOLD = 3;
const LATE_PENALTY_RATE = 0.5;

export class AttendanceCalculator implements IPayrollCalculator {
  name = "Attendance";
  order = 20;
  applicableTo: EmployeeType[] | null = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { attendance, metadata } = ctx;
    const dailyRate = (metadata.dailyRate as number) ?? 0;
    const lines = [];

    if (attendance.absentDays > 0) {
      const amount = dailyRate * attendance.absentDays;
      lines.push(
        buildLine({
          componentCode: "ABSENT_DEDUCTION",
          componentName: "Potongan Alpha",
          category: ComponentCategory.DEDUCTION,
          quantity: attendance.absentDays,
          rate: dailyRate,
          amount,
          formula: `${dailyRate} × ${attendance.absentDays} hari alpha`,
          sortOrder: 10,
        }),
      );
    }

    if (attendance.lateDays > LATE_THRESHOLD) {
      const lateRate = Math.floor(dailyRate * LATE_PENALTY_RATE);
      const amount = lateRate * attendance.lateDays;
      lines.push(
        buildLine({
          componentCode: "LATE_DEDUCTION",
          componentName: "Potongan Keterlambatan",
          category: ComponentCategory.DEDUCTION,
          quantity: attendance.lateDays,
          rate: lateRate,
          amount,
          formula: `${lateRate} × ${attendance.lateDays} hari telat (>${LATE_THRESHOLD} threshold)`,
          sortOrder: 11,
        }),
      );
    }

    return { lines };
  }
}
