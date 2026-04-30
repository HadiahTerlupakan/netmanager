import type { LeaveType } from "../types/attendance.enums";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveBalanceRepository } from "../repositories/LeaveBalanceRepository";

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

export class HolidayLookupService {
  constructor(private readonly repository = new HolidayRepository()) {}

  /** Check whether the given date is a holiday for a tenant. */
  isHoliday(date: Date, tenantId: string) {
    return this.repository.isHoliday(date, tenantId);
  }
}

export class LeaveBalanceQueryService {
  constructor(private readonly repository = new LeaveBalanceRepository()) {}

  /** Get remaining leave days for a user. */
  getRemainingDays(
    userId: string,
    year: number,
    leaveType: LeaveType,
    tenantId?: string,
  ) {
    return this.repository.getRemainingDays(userId, year, leaveType, tenantId);
  }
}

export class AttendancePayrollQueryService {
  constructor(private readonly repository = new AttendanceRepository()) {}

  /** Find payroll evaluations for one user in a date range. */
  findManyPayrollEvaluationsByUserAndDateRange(
    input: Parameters<
      AttendanceRepository["findManyPayrollEvaluationsByUserAndDateRange"]
    >[0],
  ) {
    return this.repository.findManyPayrollEvaluationsByUserAndDateRange(input);
  }
}
