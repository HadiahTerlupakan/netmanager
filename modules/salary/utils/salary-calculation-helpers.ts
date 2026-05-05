import type {
  EmployeeType,
  PtkpStatus,
  RateType,
} from "../domain/entities/SalaryEntity";
import { calculatePph21Ter as calculatePph21TerFromHelper } from "./salary-calculation-tax.helpers";

export interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  sick: number;
  permit: number;
  workDays: number;
}

export type OvertimePayInput = {
  stats: OvertimeStats;
  rateType: RateType | null;
  rateNormal: number;
  rateHoliday: number;
  rateNational: number;
  basicSalary: number;
  workDays: number;
};

export interface OvertimeStats {
  totalMinutes: number;
  normalMinutes: number;
  holidayMinutes: number;
  nationalHolidayMinutes: number;
  normalCount: number;
  holidayCount: number;
  nationalCount: number;
  totalCount: number;
}

export type PayrollEvaluationSummary = {
  workDate: Date;
  finalStatus: string | null;
  holidayState: string | null;
  overtimeMinutesApproved: number;
  overtimeMinutesHeld: number;
  payrollHoldState: string | null;
};

export type UserCalculationData = {
  id: string;
  name: string | null;
  basicSalary: number | null;
  employeeType: EmployeeType;
  departmentId: string | null;
  siteId: string | null;
  payPeriodDay: number | null;
  payDay: number | null;
  woIncentiveEnabled: boolean;
  woIncentiveRate: number | null;
  lateDeductionRate: number | null;
  absentDeductionRate: number | null;
  overtimeRateNormal: number | null;
  overtimeRateHoliday: number | null;
  overtimeRateNational: number | null;
  overtimeCalcTypeNormal: RateType | null;
  overtimeCalcTypeHoliday: RateType | null;
  overtimeCalcTypeNational: RateType | null;
  workDays: string | null;
  joinDate: Date | null;
  ptkpStatus: PtkpStatus | null;
  bpjsKesehatan: boolean;
  bpjsKetenagakerjaan: boolean;
};

export { getPeriodDateRange } from "./salary-calculation-date.helpers";
export {
  calculateProratedBasicSalary,
  calculateWorkDays,
  getDefaultWorkDaysString,
} from "./salary-calculation-workday.helpers";
export { getStandardMinutesPerDay } from "./salary-calculation-time.helpers";

/** Buat statistik kehadiran awal. */
export function createAttendanceStats(workDays: number): AttendanceStats {
  return { present: 0, late: 0, absent: 0, sick: 0, permit: 0, workDays };
}

/** Terapkan status kehadiran ke ringkasan statistik. */
export function applyAttendanceStatus(
  stats: AttendanceStats,
  status: string | null,
): void {
  if (status === "ON_TIME") stats.present++;
  else if (status === "LATE") {
    stats.present++;
    stats.late++;
  } else if (status === "ALPHA" || status === "ABSENT") stats.absent++;
  else if (status === "SICK") stats.sick++;
  else if (status === "PERMIT") stats.permit++;
}

/** Buat statistik lembur awal. */
export function createOvertimeStats(): OvertimeStats {
  return {
    totalMinutes: 0,
    normalMinutes: 0,
    holidayMinutes: 0,
    nationalHolidayMinutes: 0,
    normalCount: 0,
    holidayCount: 0,
    nationalCount: 0,
    totalCount: 0,
  };
}

/** Tambahkan durasi lembur ke kategori yang sesuai. */
export function applyOvertimeMinutes(
  stats: OvertimeStats,
  minutes: number,
  isNationalHoliday: boolean,
  isHolidayOvertime: boolean,
): void {
  if (minutes <= 0) {
    return;
  }

  stats.totalMinutes += minutes;
  stats.totalCount++;

  if (isNationalHoliday) {
    stats.nationalHolidayMinutes += minutes;
    stats.nationalCount++;
    return;
  }

  if (isHolidayOvertime) {
    stats.holidayMinutes += minutes;
    stats.holidayCount++;
    return;
  }

  stats.normalMinutes += minutes;
  stats.normalCount++;
}

/** Ubah tanggal menjadi key YYYY-MM-DD berbasis UTC. */
export function getDateKey(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Bentuk map evaluasi payroll per tanggal kerja. */
export function createPayrollEvaluationMap(
  payrollEvaluations: PayrollEvaluationSummary[],
): Map<string, PayrollEvaluationSummary> {
  const evaluationMap = new Map<string, PayrollEvaluationSummary>();

  for (const evaluation of payrollEvaluations) {
    const dateKey = getDateKey(evaluation.workDate);
    if (dateKey) {
      evaluationMap.set(dateKey, evaluation);
    }
  }

  return evaluationMap;
}

/** Cek apakah status libur termasuk libur nasional. */
export function isNationalHolidayState(holidayState: string | null): boolean {
  return holidayState === "LIBUR_NASIONAL";
}

/** Hitung upah lembur berdasarkan mode tarif pengguna. */
export function calculateOvertimePay(input: OvertimePayInput): {
  amount: number;
  hours: number;
  rate: number;
} {
  if (input.rateType === "FIXED") return calculateFixedOvertimePay(input);
  if (input.rateType === "PERCENTAGE")
    return calculatePercentageOvertimePay(input);
  if (input.rateType === "DAILY_SALARY")
    return calculateDailySalaryOvertimePay(input);
  return calculateHourlyOvertimePay(input);
}

function calculateFixedOvertimePay(input: OvertimePayInput) {
  return buildOvertimePayResult(
    input,
    input.stats.normalCount * input.rateNormal +
      input.stats.holidayCount * input.rateHoliday +
      input.stats.nationalCount * input.rateNational,
    input.rateNormal,
  );
}

function calculatePercentageOvertimePay(input: OvertimePayInput) {
  const hourlyRate =
    ((input.basicSalary / input.workDays) * input.rateNormal) / 100;
  return buildOvertimePayResult(
    input,
    calculateWeightedMinutePay(
      input,
      hourlyRate,
      getPercentageMultipliers(input),
    ),
    hourlyRate,
  );
}

function calculateDailySalaryOvertimePay(input: OvertimePayInput) {
  const dailySalary = input.basicSalary / input.workDays;
  return buildOvertimePayResult(
    input,
    calculateWeightedDayPay(
      input,
      dailySalary,
      getDailySalaryMultipliers(input),
    ),
    dailySalary,
  );
}

function calculateHourlyOvertimePay(input: OvertimePayInput) {
  return buildOvertimePayResult(
    input,
    calculateHourlyOvertimeAmount(input),
    input.rateNormal,
  );
}

function calculateHourlyOvertimeAmount(input: OvertimePayInput) {
  return (
    (input.stats.normalMinutes / 60) * input.rateNormal +
    (input.stats.holidayMinutes / 60) * input.rateHoliday +
    (input.stats.nationalHolidayMinutes / 60) * input.rateNational
  );
}

function calculateWeightedMinutePay(
  input: OvertimePayInput,
  baseRate: number,
  multipliers: { holiday: number; national: number },
) {
  return (
    (input.stats.normalMinutes / 60) * baseRate +
    (input.stats.holidayMinutes / 60) * baseRate * multipliers.holiday +
    (input.stats.nationalHolidayMinutes / 60) * baseRate * multipliers.national
  );
}

function calculateWeightedDayPay(
  input: OvertimePayInput,
  dailySalary: number,
  multipliers: { holiday: number; national: number },
) {
  return (
    (input.stats.normalMinutes / 60 / 8) * dailySalary +
    (input.stats.holidayMinutes / 60 / 8) * dailySalary * multipliers.holiday +
    (input.stats.nationalHolidayMinutes / 60 / 8) *
      dailySalary *
      multipliers.national
  );
}

function getPercentageMultipliers(input: OvertimePayInput) {
  return {
    holiday: input.rateHoliday > 0 ? input.rateHoliday / 100 : 2,
    national: input.rateNational > 0 ? input.rateNational / 100 : 3,
  };
}

function getDailySalaryMultipliers(input: OvertimePayInput) {
  return {
    holiday: input.rateHoliday > 0 ? input.rateHoliday / 100 : 1,
    national: input.rateNational > 0 ? input.rateNational / 100 : 1,
  };
}

function buildOvertimePayResult(
  input: OvertimePayInput,
  amount: number,
  rate: number,
) {
  return { amount, hours: input.stats.totalMinutes / 60, rate };
}

/** Hitung potongan PPh21 TER berdasarkan status PTKP. */
export function calculatePph21Ter(
  grossIncome: number,
  ptkpStatus: import("../domain/entities/SalaryEntity").PtkpStatus,
): number {
  return calculatePph21TerFromHelper(grossIncome, ptkpStatus);
}
