import { AttendanceRepository } from "../repositories/AttendanceRepository";

export class AttendanceQueryService {
  constructor(private readonly repository = new AttendanceRepository()) {}

  /** Get daily attendance stats for dashboard use cases. */
  getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.repository.getDailyStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  /** Get per-user attendance stats for leaderboard and payroll use cases. */
  getUserAttendanceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.repository.getUserAttendanceStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  /** Find a single attendance record with selected user fields. */
  findFirstWithUser(
    input: Parameters<AttendanceRepository["findFirstWithUser"]>[0],
  ) {
    return this.repository.findFirstWithUser(input);
  }

  /** Find payroll evaluations for one user in a date range. */
  findManyPayrollEvaluationsByUserAndDateRange(
    input: Parameters<
      AttendanceRepository["findManyPayrollEvaluationsByUserAndDateRange"]
    >[0],
  ) {
    return this.repository.findManyPayrollEvaluationsByUserAndDateRange(input);
  }
}
