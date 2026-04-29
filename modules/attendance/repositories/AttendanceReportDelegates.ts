import { AttendanceReportRepository } from "./AttendanceReportRepository";

export class AttendanceReportDelegates {
  constructor(
    private readonly reportRepository = new AttendanceReportRepository(),
  ) {}

  /** Ambil statistik attendance rentang tanggal. */
  getStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getStatsByDateRange(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil statistik evaluasi attendance rentang tanggal. */
  getEvaluationStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getEvaluationStatsByDateRange(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil statistik harian attendance. */
  getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.reportRepository.getDailyStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  /** Ambil statistik attendance berdasarkan group. */
  getGroupedStats(
    startDate: Date,
    endDate: Date,
    groupBy: "department" | "site",
    tenantId?: string,
  ) {
    return this.reportRepository.getGroupedStats(
      startDate,
      endDate,
      groupBy,
      tenantId,
    );
  }

  /** Ambil top employee attendance. */
  getTopEmployees(
    startDate: Date,
    endDate: Date,
    limit: number,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getTopEmployees(
      startDate,
      endDate,
      limit,
      siteId,
      departmentId,
    );
  }

  /** Ambil top absentee attendance. */
  getTopAbsentees(
    startDate: Date,
    endDate: Date,
    limit: number,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getTopAbsentees(
      startDate,
      endDate,
      limit,
      siteId,
      departmentId,
    );
  }

  /** Ambil statistik attendance per user. */
  getUserAttendanceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.reportRepository.getUserAttendanceStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  /** Ambil statistik absence per user. */
  getUserAbsenceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getUserAbsenceStats(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil record attendance per user. */
  getUserAttendanceRecords(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getUserAttendanceRecords(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil total durasi attendance per user. */
  getUserTotalDuration(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getUserTotalDuration(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil statistik keterlambatan per user. */
  getUserLateStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getUserLateStats(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }
}
