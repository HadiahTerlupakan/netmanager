import type { EmployeePayrollProfile } from "../entities/EmployeePayrollProfile";
import type { PayrollLine } from "../entities/PayrollLine";
import type { EmployeeType } from "../enums";
import type { TenantPayrollConfig } from "../../config";

export interface AttendanceSummary {
  totalWorkDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  sickDays: number;
  permitDays: number;
  effectiveDays: number;
}

export interface OvertimeSummary {
  normalMinutes: number;
  holidayMinutes: number;
  nationalHolidayMinutes: number;
  totalMinutes: number;
}

export interface CalculationContext {
  employee: EmployeePayrollProfile;
  period: { start: Date; end: Date };
  attendance: AttendanceSummary;
  overtime: OvertimeSummary;
  previousLines: PayrollLine[];
  config: TenantPayrollConfig;
  metadata: Record<string, unknown>;
}

export interface CalculationResult {
  lines: PayrollLine[];
  metadata?: Record<string, unknown>;
}

export interface IPayrollCalculator {
  name: string;
  order: number;
  applicableTo: EmployeeType[] | null;
  calculate(ctx: CalculationContext): CalculationResult;
}
