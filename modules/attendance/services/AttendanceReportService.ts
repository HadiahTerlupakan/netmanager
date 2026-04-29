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
  calculateRate,
  collectSummaryUserIds,
  createCombinedTopEmployees,
  createEmployeeSummary,
  createStatsMap,
  type UserScoreState,
} from "./attendance-report-service-helpers";

export class AttendanceReportService {
  constructor(
    private readonly attendanceRepository = new AttendanceRepository(),
    private readonly overtimeRepository = new OvertimePayrollQueryService(),
    private readonly leaveRepository = new LeaveRepository(),
    private readonly userRepository = new UserLookupService(),
  ) {}

  /** Ambil data laporan attendance agregat tanpa mengubah format public API. */
  async getReportData(input: {
    startDate: Date;
    endDate: Date;
    siteId?: string;
    departmentId?: string;
  }) {
    const reportData = await this.loadReportData(input);
    const userMap = await this.buildUserScoreMap(input, reportData);
    const combinedTopEmployees = await this.buildCombinedTopEmployees(userMap);
    const employeeSummary = await this.buildEmployeeSummary(reportData);
    const lateCount = reportData.stats.statusCounts["LATE"] || 0;
    const alphaCount = reportData.evaluationStats.statusCounts["ABSENT"] || 0;

    return {
      summary: {
        totalAttendance: reportData.stats.total,
        attendanceRate: 0,
        avgDurationMinutes: reportData.stats.avgDurationMinutes,
        lateCount,
        lateRate: calculateRate(lateCount, reportData.stats.total),
        alphaCount,
        alphaRate: calculateRate(alphaCount, reportData.evaluationStats.total),
      },
      trends: reportData.dailyStats,
      bySite: reportData.groupedBySite,
      byDepartment: reportData.groupedByDept,
      topEmployees: reportData.topEmployees,
      combinedTopEmployees,
      topAbsentees: reportData.topAbsentees,
      employeeSummary,
    };
  }

  private async loadReportData(input: {
    startDate: Date;
    endDate: Date;
    siteId?: string;
    departmentId?: string;
  }) {
    const { startDate, endDate, siteId, departmentId } = input;
    const [
      stats,
      evaluationStats,
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
      userLeaveStats,
    ] = await Promise.all([
      this.attendanceRepository.getStatsByDateRange(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      this.attendanceRepository.getEvaluationStatsByDateRange(
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
      this.attendanceRepository.getGroupedStats(startDate, endDate, "site"),
      this.attendanceRepository.getGroupedStats(
        startDate,
        endDate,
        "department",
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
      this.leaveRepository.getUserLeaveStats(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
    ]);

    return {
      stats,
      evaluationStats,
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
      userLeaveStats,
    };
  }

  private async buildUserScoreMap(
    input: {
      startDate: Date;
      endDate: Date;
      siteId?: string;
      departmentId?: string;
    },
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
  ) {
    const userLateMap = createStatsMap(
      reportData.userLateStats,
      (item) => item.userId,
      (item) => item._count._all,
    );
    const userLeaveMap = createStatsMap(
      reportData.userLeaveStats,
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
      reportData.userLeaveStats,
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
