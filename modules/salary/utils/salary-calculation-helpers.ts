import type {
  EmployeeType,
  PtkpStatus,
  RateType,
} from "../domain/entities/SalaryEntity";

export interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  sick: number;
  permit: number;
  workDays: number;
}

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

const DEFAULT_WORK_DAYS = 22;
const DEFAULT_WORK_DAYS_STRING = "Senin,Selasa,Rabu,Kamis,Jumat,Sabtu";
const DEFAULT_STANDARD_WORK_MINUTES = 8 * 60;

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

/** Hitung rentang periode payroll berdasarkan pay period day. */
export function getPeriodDateRange(input: {
  month: number;
  year: number;
  payPeriodDay: number;
}): { startDate: Date; endDate: Date } {
  let startMonth = input.month - 1;
  let startYear = input.year;

  if (startMonth === 0) {
    startMonth = 12;
    startYear = input.year - 1;
  }

  return {
    startDate: new Date(startYear, startMonth - 1, input.payPeriodDay + 1),
    endDate: new Date(
      input.year,
      input.month - 1,
      input.payPeriodDay,
      23,
      59,
      59,
    ),
  };
}

/** Hitung jumlah hari kerja aktif dalam rentang tanggal. */
export function calculateWorkDays(
  startDate: Date,
  endDate: Date,
  workDaysStr: string,
): number {
  const activeDays = workDaysStr
    .split(",")
    .map((dayName) => mapDayNameToIndex(dayName.trim()))
    .filter((dayIndex): dayIndex is number => dayIndex !== undefined);

  let totalWorkDays = 0;
  const cursor = new Date(startDate);

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
  const { user, startDate, endDate, basicSalary, attendanceWorkDays } = input;

  if (user.joinDate && user.joinDate > startDate && user.joinDate <= endDate) {
    const workDaysSinceJoin = calculateWorkDays(
      user.joinDate,
      endDate,
      user.workDays || DEFAULT_WORK_DAYS_STRING,
    );

    return {
      effectiveBasicSalary: Math.round(
        (basicSalary / attendanceWorkDays) * workDaysSinceJoin,
      ),
      isProrated: true,
    };
  }

  if (user.joinDate && user.joinDate > endDate) {
    return {
      effectiveBasicSalary: 0,
      isProrated: true,
    };
  }

  return {
    effectiveBasicSalary: basicSalary,
    isProrated: false,
  };
}

/** Hitung upah lembur berdasarkan mode tarif pengguna. */
export function calculateOvertimePay(input: {
  stats: OvertimeStats;
  rateType: RateType;
  rateNormal: number;
  rateHoliday: number;
  rateNational: number;
  basicSalary: number;
  workDays: number;
}): { amount: number; hours: number; rate: number } {
  const totalHours = input.stats.totalMinutes / 60;

  if (input.rateType === "FIXED") {
    return {
      amount:
        input.stats.normalCount * input.rateNormal +
        input.stats.holidayCount * input.rateHoliday +
        input.stats.nationalCount * input.rateNational,
      hours: totalHours,
      rate: input.rateNormal,
    };
  }

  if (input.rateType === "PERCENTAGE") {
    const dailySalary = input.basicSalary / input.workDays;
    const hourlyRate = (dailySalary * input.rateNormal) / 100;
    const holidayMultiplier =
      input.rateHoliday > 0 ? input.rateHoliday / 100 : 2;
    const nationalMultiplier =
      input.rateNational > 0 ? input.rateNational / 100 : 3;

    return {
      amount:
        (input.stats.normalMinutes / 60) * hourlyRate +
        (input.stats.holidayMinutes / 60) * hourlyRate * holidayMultiplier +
        (input.stats.nationalHolidayMinutes / 60) *
          hourlyRate *
          nationalMultiplier,
      hours: totalHours,
      rate: hourlyRate,
    };
  }

  if (input.rateType === "DAILY_SALARY") {
    const dailySalary = input.basicSalary / input.workDays;
    const holidayMultiplier =
      input.rateHoliday > 0 ? input.rateHoliday / 100 : 1;
    const nationalMultiplier =
      input.rateNational > 0 ? input.rateNational / 100 : 1;

    return {
      amount:
        (input.stats.normalMinutes / 60 / 8) * dailySalary +
        (input.stats.holidayMinutes / 60 / 8) *
          dailySalary *
          holidayMultiplier +
        (input.stats.nationalHolidayMinutes / 60 / 8) *
          dailySalary *
          nationalMultiplier,
      hours: totalHours,
      rate: dailySalary,
    };
  }

  return {
    amount:
      (input.stats.normalMinutes / 60) * input.rateNormal +
      (input.stats.holidayMinutes / 60) * input.rateHoliday +
      (input.stats.nationalHolidayMinutes / 60) * input.rateNational,
    hours: totalHours,
    rate: input.rateNormal,
  };
}

/** Hitung potongan PPh21 TER berdasarkan status PTKP. */
export function calculatePph21Ter(
  grossIncome: number,
  ptkpStatus: PtkpStatus,
): number {
  let rate = 0;

  if (["TK_0", "TK_1", "K_0"].includes(ptkpStatus)) {
    if (grossIncome <= 5400000) rate = 0;
    else if (grossIncome <= 5650000) rate = 0.0025;
    else if (grossIncome <= 5950000) rate = 0.005;
    else if (grossIncome <= 6300000) rate = 0.0075;
    else if (grossIncome <= 6750000) rate = 0.01;
    else if (grossIncome <= 7500000) rate = 0.0125;
    else if (grossIncome <= 8550000) rate = 0.015;
    else if (grossIncome <= 9650000) rate = 0.0175;
    else if (grossIncome <= 10050000) rate = 0.02;
    else if (grossIncome <= 10350000) rate = 0.0225;
    else if (grossIncome <= 10700000) rate = 0.025;
    else rate = 0.03;
  } else if (["TK_2", "TK_3", "K_1", "K_2"].includes(ptkpStatus)) {
    if (grossIncome <= 6200000) rate = 0;
    else if (grossIncome <= 6500000) rate = 0.0025;
    else if (grossIncome <= 6850000) rate = 0.005;
    else if (grossIncome <= 7300000) rate = 0.0075;
    else if (grossIncome <= 9200000) rate = 0.015;
    else if (grossIncome <= 10750000) rate = 0.02;
    else rate = 0.03;
  } else if (["K_3"].includes(ptkpStatus)) {
    if (grossIncome <= 6600000) rate = 0;
    else if (grossIncome <= 6950000) rate = 0.0025;
    else if (grossIncome <= 7350000) rate = 0.005;
    else if (grossIncome <= 7800000) rate = 0.0075;
    else if (grossIncome <= 8850000) rate = 0.01;
    else rate = 0.03;
  }

  return Math.floor(grossIncome * rate);
}

/** Hitung durasi kerja standar per hari berdasarkan konfigurasi user. */
export function getStandardMinutesPerDay(config?: {
  workingHourMode?: "FIXED" | "SHIFT" | "FLEXIBLE" | null;
  flexibleTargetHour?: number | null;
  startWorkTime?: string | null;
  endWorkTime?: string | null;
  shift?: { startTime?: string | null; endTime?: string | null } | null;
}): number {
  if (!config) {
    return DEFAULT_STANDARD_WORK_MINUTES;
  }

  if (config.workingHourMode === "FLEXIBLE") {
    return (config.flexibleTargetHour || 8) * 60;
  }

  if (config.workingHourMode === "SHIFT") {
    return calculateClockRangeMinutes(
      config.shift?.startTime,
      config.shift?.endTime,
    );
  }

  if (config.workingHourMode === "FIXED") {
    return calculateClockRangeMinutes(config.startWorkTime, config.endWorkTime);
  }

  return DEFAULT_STANDARD_WORK_MINUTES;
}

function mapDayNameToIndex(dayName: string): number | undefined {
  const parsedDay = parseInt(dayName, 10);
  return Number.isNaN(parsedDay) ? DAY_NAME_TO_INDEX[dayName] : parsedDay;
}

function calculateClockRangeMinutes(
  startTime?: string | null,
  endTime?: string | null,
): number {
  if (!startTime || !endTime) {
    return DEFAULT_STANDARD_WORK_MINUTES;
  }

  const startMinutes = toClockMinutes(startTime);
  const endMinutes = toClockMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return DEFAULT_STANDARD_WORK_MINUTES;
  }

  return endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : 24 * 60 - startMinutes + endMinutes;
}

function toClockMinutes(clock: string): number | null {
  const [hourRaw, minuteRaw] = clock.split(":").map(Number);
  const hour = hourRaw ?? 0;
  const minute = minuteRaw ?? 0;

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
}
