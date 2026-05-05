import type { UserCalculationData } from "./salary-calculation-helpers";

const DEFAULT_WORK_DAYS = 22;
const DEFAULT_WORK_DAYS_STRING = "Senin,Selasa,Rabu,Kamis,Jumat,Sabtu";

const DAY_NAME_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Minggu: 0,
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
};

/** Hitung jumlah hari kerja aktif dalam rentang tanggal. */
export function calculateWorkDays(
  startDate: Date,
  endDate: Date,
  workDaysStr: string,
): number {
  const activeDays = parseActiveDayIndexes(workDaysStr);
  const cursor = new Date(startDate);
  let totalWorkDays = 0;

  while (cursor <= endDate) {
    if (activeDays.includes(cursor.getDay())) {
      totalWorkDays++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return totalWorkDays || DEFAULT_WORK_DAYS;
}

/** Ambil string hari kerja default payroll. */
export function getDefaultWorkDaysString(): string {
  return DEFAULT_WORK_DAYS_STRING;
}

/** Hitung saldo gaji prorata untuk karyawan baru. */
export function calculateProratedBasicSalary(input: {
  user: Pick<UserCalculationData, "joinDate" | "workDays">;
  startDate: Date;
  endDate: Date;
  basicSalary: number;
  attendanceWorkDays: number;
}): { effectiveBasicSalary: number; isProrated: boolean } {
  const joinDate = input.user.joinDate;
  if (!joinDate) return buildFullSalaryResult(input.basicSalary);
  if (joinDate > input.endDate) return buildZeroSalaryResult();

  return isJoinedWithinPayrollPeriod(joinDate, input.startDate, input.endDate)
    ? buildProratedSalaryResult(input)
    : buildFullSalaryResult(input.basicSalary);
}

function buildZeroSalaryResult() {
  return { effectiveBasicSalary: 0, isProrated: true };
}

function parseActiveDayIndexes(workDaysStr: string) {
  return workDaysStr
    .split(",")
    .map((dayName) => mapDayNameToIndex(dayName.trim()))
    .filter((dayIndex): dayIndex is number => dayIndex !== undefined);
}

function mapDayNameToIndex(dayName: string): number | undefined {
  const parsedDay = Number.parseInt(dayName, 10);
  return Number.isNaN(parsedDay) ? DAY_NAME_TO_INDEX[dayName] : parsedDay;
}

function isJoinedWithinPayrollPeriod(
  joinDate: Date,
  startDate: Date,
  endDate: Date,
) {
  return joinDate > startDate && joinDate <= endDate;
}

function buildProratedSalaryResult(input: {
  user: Pick<UserCalculationData, "joinDate" | "workDays">;
  endDate: Date;
  basicSalary: number;
  attendanceWorkDays: number;
}) {
  const workDaysSinceJoin = calculateWorkDays(
    input.user.joinDate as Date,
    input.endDate,
    input.user.workDays || DEFAULT_WORK_DAYS_STRING,
  );

  return {
    effectiveBasicSalary: Math.round(
      (input.basicSalary / input.attendanceWorkDays) * workDaysSinceJoin,
    ),
    isProrated: true,
  };
}

function buildFullSalaryResult(basicSalary: number) {
  return { effectiveBasicSalary: basicSalary, isProrated: false };
}
