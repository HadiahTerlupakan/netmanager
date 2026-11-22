import { DEFAULT_TIMEZONE } from "@/lib/constants/timezone-constants";
import type { ReportSiteFilter } from "../domain/report-site-filter";
import { countLeaveDaysByUser } from "../domain/report-date-keys";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { OvertimePayrollQueryService } from "@/modules/overtime";
import { UserLookupService } from "@/modules/users";
import {
  applyAbsencePenalty,
  applyAttendanceDays,
  applyDurationStats,
  applyOfficialOvertime,
  buildTopScorers,
  buildAttendanceSummary,
  collectSummaryUserIds,
  createCombinedTopEmployees,
  createEmployeeSummary,
  createStatsMap,
  type UserScoreState,
} from "./attendance-report-service-helpers";

type ReportInput = {
  startDate: Date;
  endDate: Date;
  siteId?: ReportSiteFilter;
  departmentId?: string;
  /** Zona waktu tenant untuk menghitung hari izin; default Asia/Jakarta. */
  timezone?: string;
};

export class AttendanceReportService {
  constructor(
    private readonly attendanceRepository = new AttendanceRepository(),
    private readonly overtimeRepository = new OvertimePayrollQueryService(),
    private readonly leaveRepository = new LeaveRepository(),
    private readonly userRepository = new UserLookupService(),
  ) {}

  /**
   * Ambil data laporan kehadiran. Ringkasan dijumlahkan dari angka per pegawai
   * yang sama dengan tabel rekap, jadi kartu dan tabel selalu cocok.
   */
  async getReportData(input: ReportInput) {
    const reportData = await this.loadReportData(input);
    const userMap = await this.buildUserScoreMap(input, reportData);
    const combinedTopEmployees = await this.buildCombinedTopEmployees(userMap);
    const userLeaveDays = countLeaveDaysByUser(reportData.leavePeriods, {
      startDate: input.startDate,
      endDate: input.endDate,
      timezone: input.timezone ?? DEFAULT_TIMEZONE,
    });
    const employeeSummary = await this.buildEmployeeSummary(
      reportData,
      userLeaveDays,
    );

    return {
      summary: buildAttendanceSummary({
        userAttStats: reportData.userAttStats,
        userLateStats: reportData.userLateStats,
        userAbsenceStats: reportData.userAbsenceStats,
        avgDurationMinutes: reportData.stats.avgDurationMinutes,
      }),
      trends: reportData.dailyStats,
      bySite: reportData.groupedBySite,
      byDepartment: reportData.groupedByDept,
      topEmployees: reportData.topEmployees,
      combinedTopEmployees,
      topAbsentees: reportData.topAbsentees,
      employeeSummary,
    };
  }

  private async loadReportData(input: ReportInput) {
    const { startDate, endDate, siteId, departmentId } = input;
    const [
      stats,
      dailyStats,
      groupedBySite,
      groupedByDept,
      topEmployees,
      userAttStats,
      userOtStats,
      topAbsentees,
      userTotalDuration,
      userAbsenceStats,
      userLateStats,
      leavePeriods,
    ] = await Promise.all([
      this.attendanceRepository.getStatsByDateRange(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      this.attendanceRepository.getDailyStats(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      this.attendanceRepository.getGroupedStats(
        startDate,
        endDate,
        "site",
        undefined,
        { siteId, departmentId },
      ),
      this.attendanceRepository.getGroupedStats(
        startDate,
        endDate,
        "department",
        undefined,
        { siteId, departmentId },
      ),
      this.attendanceRepository.getTopEmployees(
        startDate,
        endDate,
        5,
        siteId,
        departmentId,
      ),
      this.attendanceRepository.getUserAttendanceStats(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      this.overtimeRepository.getUserOvertimeStats(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      this.attendanceRepository.getTopAbsentees(
        startDate,
        endDate,
        5,
        siteId,
        departmentId,
      ),
      this.attendanceRepository.getUserTotalDuration(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      this.attendanceRepository.getUserAbsenceStats(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      this.attendanceRepository.getUserLateStats(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      this.leaveRepository.findApprovedLeavePeriods(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
    ]);

    return {
      stats,
      dailyStats,
      groupedBySite,
      groupedByDept,
      topEmployees,
      userAttStats,
      userOtStats,
      topAbsentees,
      userTotalDuration,
      userAbsenceStats,
      userLateStats,
      leavePeriods,
    };
  }

  private async buildUserScoreMap(
    input: ReportInput,
    reportData: Awaited<ReturnType<AttendanceReportService["loadReportData"]>>,
  ) {
    const userMap = new Map<string, UserScoreState>();
    applyAttendanceDays(userMap, reportData.userAttStats);
    applyOfficialOvertime(userMap, reportData.userOtStats);
    applyAbsencePenalty(userMap, reportData.userAbsenceStats);
    const workConfigUserIds = Array.from(userMap.keys());
    const userConfigs =
      workConfigUserIds.length > 0
        ? await this.userRepository.findManyWithWorkConfig(workConfigUserIds)
        : [];
    const userConfigMap = new Map(userConfigs.map((user) => [user.id, user]));
    applyDurationStats(userMap, reportData.userTotalDuration, userConfigMap);
    return userMap;
  }

  private async buildCombinedTopEmployees(
    userMap: Map<string, UserScoreState>,
  ) {
    const topScorers = buildTopScorers(userMap);
    if (topScorers.length === 0) return [];
    const users = await this.userRepository.findManyWithBasicInfo(
      topScorers.map((scorer) => scorer.userId),
    );
    return createCombinedTopEmployees(topScorers, users);
  }

  private async buildEmployeeSummary(
    reportData: Awaited<ReturnType<AttendanceReportService["loadReportData"]>>,
    userLeaveMap: Map<string, number>,
  ) {
    const userLateMap = createStatsMap(
      reportData.userLateStats,
      (item) => item.userId,
      (item) => item._count._all,
    );
    const userAbsenceMap = createStatsMap(
      reportData.userAbsenceStats,
      (item) => item.userId,
      (item) => item._count._all,
    );
    const userOtMap = createStatsMap(
      reportData.userOtStats,
      (item) => item.userId,
      (item) => item.totalDuration || 0,
    );
    const userAttMap = createStatsMap(
      reportData.userAttStats,
      (item) => item.userId,
      (item) => item._count._all,
    );
    const summaryUserIds = collectSummaryUserIds(
      reportData.userAttStats,
      reportData.userAbsenceStats,
      [...userLeaveMap.keys()],
    );
    const allUsers =
      await this.userRepository.findManyWithFullDetails(summaryUserIds);
    const userDetailsMap = new Map(allUsers.map((user) => [user.id, user]));

    return createEmployeeSummary({
      userIds: summaryUserIds,
      userDetailsMap,
      userAttMap,
      userLateMap,
      userLeaveMap,
      userAbsenceMap,
      userOtMap,
      userTotalDuration: reportData.userTotalDuration,
    });
  }
}
