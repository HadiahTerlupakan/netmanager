import { AttendanceDailyStatsRepository } from "./AttendanceDailyStatsRepository";
import { AttendanceReportRankingRepository } from "./AttendanceReportRankingRepository";
import { AttendanceReportSummaryRepository } from "./AttendanceReportSummaryRepository";
import { AttendanceUserReportRepository } from "./AttendanceUserReportRepository";

export class AttendanceReportRepository {
  private readonly dailyStats = new AttendanceDailyStatsRepository();
  private readonly ranking = new AttendanceReportRankingRepository();
  private readonly summary = new AttendanceReportSummaryRepository();
  private readonly userReport = new AttendanceUserReportRepository();

  /** Ambil ringkasan status attendance berdasarkan rentang tanggal. */
  getStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.summary.getStatsByDateRange(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil ringkasan status evaluasi attendance berdasarkan rentang tanggal. */
  getEvaluationStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.summary.getEvaluationStatsByDateRange(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil statistik attendance harian. */
  getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.dailyStats.getDailyStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  /** Ambil statistik attendance berdasarkan site atau department. */
  getGroupedStats(
    startDate: Date,
    endDate: Date,
    groupBy: "department" | "site",
    tenantId?: string,
  ) {
    return this.ranking.getGroupedStats(startDate, endDate, groupBy, tenantId);
  }

  /** Ambil user dengan attendance hadir terbanyak. */
  getTopEmployees(
    startDate: Date,
    endDate: Date,
    limit = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.ranking.getTopEmployees(
      startDate,
      endDate,
      limit,
      siteId,
      departmentId,
    );
  }

  /** Ambil user fixed-hour dengan alpha/absent terbanyak. */
  getTopAbsentees(
    startDate: Date,
    endDate: Date,
    limit = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.ranking.getTopAbsentees(
      startDate,
      endDate,
      limit,
      siteId,
      departmentId,
    );
  }

  /** Ambil jumlah attendance hadir per user. */
  getUserAttendanceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.userReport.getUserAttendanceStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  /** Ambil jumlah absence per user fixed-hour. */
  getUserAbsenceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.userReport.getUserAbsenceStats(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil record attendance hadir per user. */
  getUserAttendanceRecords(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.userReport.getUserAttendanceRecords(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil total durasi kerja per user. */
  getUserTotalDuration(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.userReport.getUserTotalDuration(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil jumlah keterlambatan per user. */
  getUserLateStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.userReport.getUserLateStats(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }
}
