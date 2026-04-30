import {
  applyAttendanceStatus,
  applyOvertimeMinutes,
  calculateWorkDays,
  createAttendanceStats,
  createOvertimeStats,
  createPayrollEvaluationMap,
  getDateKey,
  getDefaultWorkDaysString,
  isNationalHolidayState,
  type AttendanceStats,
  type OvertimeStats,
  type PayrollEvaluationSummary,
} from "../utils/salary-calculation-helpers";
import {
  AttendanceRepositoryForSalary,
  OvertimeRepositoryForSalary,
  UserRepository,
  WorkOrderRepositoryForSalary,
} from "../repositories/SalaryCalculationRepositories";

/** Mengambil statistik attendance, overtime, dan work-order untuk kalkulasi salary. */
export class SalaryStatsQueryService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly attendanceRepository = new AttendanceRepositoryForSalary(),
    private readonly overtimeRepository = new OvertimeRepositoryForSalary(),
    private readonly workOrderRepository = new WorkOrderRepositoryForSalary(),
  ) {}

  /** Ambil statistik attendance dalam periode salary. */
  async getAttendanceStats(input: SalaryStatsInput): Promise<AttendanceStats> {
    const [attendances, userWorkDays] = await Promise.all([
      this.attendanceRepository.findByUserAndDateRange(
        input.userId,
        input.startDate,
        input.endDate,
      ),
      this.userRepository.findWorkDays(input.userId),
    ]);

    const workDays = calculateWorkDays(
      input.startDate,
      input.endDate,
      userWorkDays?.workDays || getDefaultWorkDaysString(),
    );
    const stats = createAttendanceStats(workDays);
    const processedDateKeys = applyAttendanceRows(
      stats,
      attendances,
      input.payrollEvaluations,
    );
    applyUnprocessedEvaluations(
      stats,
      input.payrollEvaluations,
      processedDateKeys,
    );
    return stats;
  }

  /** Ambil statistik overtime dalam periode salary. */
  async getOvertimeStats(input: SalaryStatsInput): Promise<OvertimeStats> {
    const overtimes =
      await this.overtimeRepository.findApprovedByUserAndDateRange(
        input.userId,
        input.startDate,
        input.endDate,
      );
    const stats = createOvertimeStats();
    const evaluationMap = createPayrollEvaluationMap(input.payrollEvaluations);
    const processedEvaluationDateKeys = new Set<string>();

    for (const overtime of overtimes) {
      const overtimeDate = overtime.startTime ?? overtime.createdAt;
      const dateKey = getDateKey(overtimeDate);
      const evaluation = dateKey ? evaluationMap.get(dateKey) : undefined;

      if (!evaluation) {
        applyOvertimeMinutes(
          stats,
          overtime.duration || 0,
          Boolean(overtime.isNationalHoliday),
          Boolean(overtime.isHolidayOvertime),
        );
        continue;
      }

      if (!dateKey || processedEvaluationDateKeys.has(dateKey)) {
        continue;
      }

      applyEvaluationOvertime(stats, evaluation);
      processedEvaluationDateKeys.add(dateKey);
    }

    return stats;
  }

  /** Ambil jumlah work-order selesai dalam periode salary. */
  async getWorkOrderStats(input: Omit<SalaryStatsInput, "payrollEvaluations">) {
    const completed = await this.workOrderRepository.countCompletedForUser(
      input.userId,
      input.startDate,
      input.endDate,
    );
    return { completed };
  }
}

type SalaryStatsInput = {
  userId: string;
  startDate: Date;
  endDate: Date;
  payrollEvaluations: PayrollEvaluationSummary[];
};

function applyAttendanceRows(
  stats: AttendanceStats,
  attendances: Array<{ checkIn: Date | null; status: string }>,
  payrollEvaluations: PayrollEvaluationSummary[],
) {
  const evaluationMap = createPayrollEvaluationMap(payrollEvaluations);
  const processedDateKeys = new Set<string>();

  for (const attendance of attendances) {
    const dateKey = getDateKey(attendance.checkIn);
    const evaluation = dateKey ? evaluationMap.get(dateKey) : undefined;
    const status = evaluation?.finalStatus ?? attendance.status;
    applyAttendanceStatus(stats, status);

    if (dateKey) {
      processedDateKeys.add(dateKey);
    }
  }

  return processedDateKeys;
}

function applyUnprocessedEvaluations(
  stats: AttendanceStats,
  payrollEvaluations: PayrollEvaluationSummary[],
  processedDateKeys: Set<string>,
) {
  for (const evaluation of payrollEvaluations) {
    const dateKey = getDateKey(evaluation.workDate);
    if (!dateKey || processedDateKeys.has(dateKey)) {
      continue;
    }

    applyAttendanceStatus(stats, evaluation.finalStatus);
  }
}

function applyEvaluationOvertime(
  stats: OvertimeStats,
  evaluation: PayrollEvaluationSummary,
) {
  const isNationalHoliday = isNationalHolidayState(evaluation.holidayState);
  const isHolidayOvertime =
    evaluation.finalStatus === "DAY_OFF" ? !isNationalHoliday : false;

  applyOvertimeMinutes(
    stats,
    evaluation.overtimeMinutesApproved,
    isNationalHoliday,
    isHolidayOvertime,
  );
}
