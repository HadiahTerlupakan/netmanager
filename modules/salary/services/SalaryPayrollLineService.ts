import {
  calculateOvertimePay,
  calculatePph21Ter,
  type AttendanceStats,
  type OvertimeStats,
  type UserCalculationData,
} from "../utils/salary-calculation-helpers";

export type SalaryLine = {
  name: string;
  amount: number;
  quantity?: number;
  rate?: number;
  notes?: string;
};

type WorkOrderStats = { completed: number };

type PayrollLineInput = {
  user: UserCalculationData;
  basicSalary: number;
  effectiveBasicSalary: number;
  attendanceStats: AttendanceStats;
  overtimeStats: OvertimeStats;
  workOrderStats: WorkOrderStats;
};

/** Membangun line payroll non-komponen untuk hasil kalkulasi salary. */
export class SalaryPayrollLineService {
  /** Bangun earning dari gaji pokok, lembur, WO, dan informasi izin/sakit. */
  buildEarningLines(input: PayrollLineInput) {
    return [
      this.buildBasicSalaryLine(input),
      ...this.buildOvertimeLines(input),
      ...this.buildWorkOrderIncentiveLines(input),
      ...this.buildAttendanceInfoLines(input.attendanceStats),
    ];
  }

  /** Bangun deduction attendance, BPJS, dan PPh 21. */
  buildDeductionLines(input: PayrollLineInput & { earnings: SalaryLine[] }) {
    return [
      ...this.buildAttendanceDeductionLines(input),
      ...this.buildBpjsDeductionLines(input.user, input.earnings),
      ...this.buildTaxDeductionLines(input.user, input.earnings),
    ];
  }

  private buildBasicSalaryLine(input: PayrollLineInput): SalaryLine {
    return {
      name: "Gaji Pokok",
      amount: input.effectiveBasicSalary,
      notes:
        input.effectiveBasicSalary > 0 &&
        input.effectiveBasicSalary !== input.basicSalary
          ? "Prorate (karyawan baru)"
          : undefined,
    };
  }

  private buildOvertimeLines(input: PayrollLineInput): SalaryLine[] {
    if (input.overtimeStats.totalMinutes <= 0) {
      return [];
    }

    const overtimePay = calculateOvertimePay({
      stats: input.overtimeStats,
      rateType: input.user.overtimeCalcTypeNormal,
      rateNormal: input.user.overtimeRateNormal || 0,
      rateHoliday: input.user.overtimeRateHoliday || 0,
      rateNational: input.user.overtimeRateNational || 0,
      basicSalary: input.basicSalary,
      workDays: input.attendanceStats.workDays,
    });

    if (overtimePay.amount <= 0) {
      return [];
    }

    return [
      {
        name: "Lembur",
        amount: Math.round(overtimePay.amount),
        quantity: Number(overtimePay.hours.toFixed(1)),
        rate: Math.round(overtimePay.rate),
        notes: `Total ${overtimePay.hours.toFixed(1)} jam`,
      },
    ];
  }

  private buildWorkOrderIncentiveLines(input: PayrollLineInput): SalaryLine[] {
    if (!input.user.woIncentiveEnabled || input.workOrderStats.completed <= 0) {
      return [];
    }

    const rate = input.user.woIncentiveRate || 0;
    return [
      {
        name: "Insentif WO",
        amount: Math.round(input.workOrderStats.completed * rate),
        quantity: input.workOrderStats.completed,
        rate,
        notes: `${input.workOrderStats.completed} WO selesai`,
      },
    ];
  }

  private buildAttendanceInfoLines(
    attendanceStats: AttendanceStats,
  ): SalaryLine[] {
    const lines: SalaryLine[] = [];
    if (attendanceStats.sick > 0) {
      lines.push({
        name: "Sakit",
        amount: 0,
        quantity: attendanceStats.sick,
        notes: `${attendanceStats.sick} hari (Informasi)`,
      });
    }
    if (attendanceStats.permit > 0) {
      lines.push({
        name: "Izin",
        amount: 0,
        quantity: attendanceStats.permit,
        notes: `${attendanceStats.permit} hari (Informasi)`,
      });
    }
    return lines;
  }

  private buildAttendanceDeductionLines(input: PayrollLineInput): SalaryLine[] {
    const { attendanceStats } = input;
    if (!hasAttendanceDeduction(attendanceStats)) {
      return [];
    }

    const deductionPerDay = Math.round(
      input.effectiveBasicSalary / attendanceStats.workDays,
    );
    const absentDeduction = calculateAbsentDeduction(
      input.user,
      attendanceStats.absent,
      deductionPerDay,
    );

    if (absentDeduction <= 0) {
      return [];
    }

    return [
      {
        name: "Potongan Alpha / Unpaid",
        amount: absentDeduction,
        quantity: attendanceStats.absent,
        rate: Math.max(deductionPerDay, input.user.absentDeductionRate || 0),
        notes: `${attendanceStats.absent} hari absen/unpaid`,
      },
    ];
  }

  private buildBpjsDeductionLines(
    user: UserCalculationData,
    earnings: SalaryLine[],
  ) {
    const baseSalary = calculateBpjsBaseSalary(earnings);
    const lines: SalaryLine[] = [];

    if (user.bpjsKesehatan) {
      lines.push({
        name: "BPJS Kesehatan (1%)",
        amount: Math.round(Math.min(12000000, baseSalary) * 0.01),
        notes: "Batas max Rp12jt",
      });
    }

    if (user.bpjsKetenagakerjaan) {
      lines.push(
        { name: "BPJS JHT (2%)", amount: Math.round(baseSalary * 0.02) },
        {
          name: "BPJS Pensiun (1%)",
          amount: Math.round(Math.min(10042300, baseSalary) * 0.01),
          notes: "Batas max Rp10jt",
        },
      );
    }

    return lines;
  }

  private buildTaxDeductionLines(
    user: UserCalculationData,
    earnings: SalaryLine[],
  ) {
    const grossIncome = earnings.reduce(
      (sum, earning) => sum + earning.amount,
      0,
    );
    if (!user.ptkpStatus || grossIncome <= 0) {
      return [];
    }

    const amount = calculatePph21Ter(grossIncome, user.ptkpStatus);
    if (amount <= 0) {
      return [];
    }

    return [
      {
        name: "Pajak PPh 21 (TER)",
        amount,
        notes: `Status PTKP: ${user.ptkpStatus.replace("_", "/")}`,
      },
    ];
  }
}

function hasAttendanceDeduction(attendanceStats: AttendanceStats) {
  return (
    attendanceStats.absent > 0 ||
    attendanceStats.sick > 0 ||
    attendanceStats.permit > 0
  );
}

function calculateAbsentDeduction(
  user: UserCalculationData,
  absentDays: number,
  deductionPerDay: number,
) {
  if (user.absentDeductionRate && user.absentDeductionRate > deductionPerDay) {
    return user.absentDeductionRate * absentDays;
  }
  return deductionPerDay * absentDays;
}

function calculateBpjsBaseSalary(earnings: SalaryLine[]) {
  return earnings
    .filter(
      (earning) => earning.name === "Gaji Pokok" || earning.rate !== undefined,
    )
    .reduce((sum, earning) => sum + earning.amount, 0);
}
