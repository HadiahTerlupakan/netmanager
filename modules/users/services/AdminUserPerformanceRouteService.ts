import { prisma } from "@/modules/database";
import {
  buildFlexibleStats,
  buildLeadWorkOrderWhere,
  buildOverallWorkOrderWhere,
  buildPerformancePeriod,
  buildSalesPerformanceSummary,
  buildSalesPeriodRange,
  buildSupportWorkOrderWhere,
  buildWorkOrderStats,
  createEmptyFlexibleStats,
  getCompletedWorkOrderStatuses,
  mapAttendanceStats,
  mapCanvasingStats,
  mapLeaveStats,
  mapPointStats,
  type SalesPeriod,
  type UserPerformancePeriod,
} from "./AdminUserPerformanceRouteService.helpers";

const DEFAULT_TARGET_HOUR = 8;

export class AdminUserPerformanceRouteService {
  /** Get aggregated user performance data for admin route. */
  async getUserPerformance(
    userId: string,
    params: {
      dateFrom?: string | null;
      dateTo?: string | null;
      period?: string | null;
    },
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { workingHourMode: true, flexibleTargetHour: true },
    });
    if (!user) return null;

    const period = buildPerformancePeriod(params);
    const [attendance, flexibleStats, leaves, workOrders] = await Promise.all([
      this.getAttendanceStats(userId, period),
      this.getFlexibleStats(
        userId,
        user.workingHourMode || "FIXED",
        user.flexibleTargetHour || DEFAULT_TARGET_HOUR,
        period,
      ),
      this.getLeaveStats(userId, period),
      this.getWorkOrderStats(userId, period),
    ]);

    return {
      workingHourMode: user.workingHourMode || "FIXED",
      attendance,
      flexibleStats,
      leaves,
      workOrders,
    };
  }

  /** Get sales performance summary for admin route. */
  async getSalesPerformance(userId: string, period: SalesPeriod) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, canvasingTarget: true },
    });
    if (!user) return null;

    const range = buildSalesPeriodRange(period);
    const salesData = await this.loadSalesPerformanceData(
      userId,
      period,
      range,
    );

    return buildSalesPerformanceSummary({
      user,
      period,
      canvasing: salesData.canvasing,
      points: salesData.points,
      totalAllTime: salesData.totalAllTime,
      totalPointsAllTime: salesData.totalPointsAllTime._sum?.pointValue || 0,
      recentActivityRaw: salesData.recentActivityRaw,
    });
  }

  /** Get user restriction context for scoped routes. */
  async getUserRestrictionContext(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { siteId: true, departmentId: true },
    });
  }

  /** Force logout a user by increasing token version. */
  async forceLogoutUser(targetUserId: string) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, tokenVersion: true },
    });
    if (!targetUser) return null;
    return prisma.user.update({
      where: { id: targetUserId },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true, name: true, tokenVersion: true },
    });
  }

  /** Get grouped attendance statistics in a date range. */
  private async getAttendanceStats(
    userId: string,
    period: UserPerformancePeriod,
  ) {
    const attendanceStats = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        userId,
        checkIn: { gte: period.startDate, lte: period.endDate },
      },
      _count: { _all: true },
    });

    return mapAttendanceStats(
      attendanceStats as Array<{ status: string; _count: { _all: number } }>,
    );
  }

  /** Get flexible working-hour statistics. */
  private async getFlexibleStats(
    userId: string,
    workingHourMode: string,
    flexibleTargetHour: number,
    period: UserPerformancePeriod,
  ) {
    if (workingHourMode !== "FLEXIBLE") {
      return createEmptyFlexibleStats(flexibleTargetHour);
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        checkIn: { gte: period.startDate, lte: period.endDate },
        checkOut: { not: null },
      },
      select: { checkIn: true, checkOut: true },
    });
    const totalMinutes = attendances.reduce(
      (sum, item) =>
        sum + (item.checkOut!.getTime() - item.checkIn.getTime()) / (1000 * 60),
      0,
    );

    return buildFlexibleStats(
      totalMinutes,
      attendances.length,
      flexibleTargetHour,
    );
  }

  /** Get approved leave statistics. */
  private async getLeaveStats(userId: string, period: UserPerformancePeriod) {
    const leaveStats = await prisma.leaveRequest.groupBy({
      by: ["type"],
      where: {
        userId,
        status: "APPROVED",
        startDate: { gte: period.startDate, lte: period.endDate },
      },
      _count: { _all: true },
    });

    return mapLeaveStats(
      leaveStats as Array<{ type: string; _count: { _all: number } }>,
    );
  }

  /** Get work-order statistics for a user. */
  private async getWorkOrderStats(
    userId: string,
    period: UserPerformancePeriod,
  ) {
    const leadWhere = buildLeadWorkOrderWhere(userId, period);
    const supportWhere = buildSupportWorkOrderWhere(userId, period);
    const overallWhere = buildOverallWorkOrderWhere(userId, period);
    const completedStatuses = getCompletedWorkOrderStatuses();

    const [
      leadTotal,
      leadCompleted,
      supportTotal,
      supportCompleted,
      overallRating,
    ] = await Promise.all([
      prisma.workOrders.count({ where: leadWhere }),
      prisma.workOrders.count({
        where: { ...leadWhere, status: { in: completedStatuses } },
      }),
      prisma.workOrders.count({ where: supportWhere }),
      prisma.workOrders.count({
        where: { ...supportWhere, status: { in: completedStatuses } },
      }),
      prisma.workOrders.aggregate({
        where: overallWhere,
        _avg: { rating: true },
      }),
    ]);

    return buildWorkOrderStats(
      leadTotal,
      leadCompleted,
      supportTotal,
      supportCompleted,
      overallRating._avg?.rating,
    );
  }

  /** Get canvasing statistics for the selected period. */
  private async getCanvasingStats(
    userId: string,
    period: SalesPeriod,
    range: UserPerformancePeriod,
  ) {
    const canvasingStats = await prisma.canvasing.groupBy({
      by: ["status"],
      where: {
        salesId: userId,
        ...(period !== "all"
          ? { createdAt: { gte: range.startDate, lte: range.endDate } }
          : {}),
      },
      _count: { _all: true },
    });

    return mapCanvasingStats(
      canvasingStats as Array<{ status: string; _count: { _all: number } }>,
    );
  }

  /** Get point claim statistics for the selected period. */
  private async getPointStats(
    userId: string,
    period: SalesPeriod,
    range: UserPerformancePeriod,
  ) {
    const pointClaimStats = await prisma.pointClaim.groupBy({
      by: ["status"],
      where: {
        salesId: userId,
        ...(period !== "all"
          ? { createdAt: { gte: range.startDate, lte: range.endDate } }
          : {}),
      },
      _count: { _all: true },
      _sum: { pointValue: true },
    });

    return mapPointStats(
      pointClaimStats as Array<{
        status: string;
        _count: { _all: number };
        _sum: { pointValue: number | null };
      }>,
    );
  }

  /** Memuat seluruh query performa sales yang berjalan paralel. */
  private async loadSalesPerformanceData(
    userId: string,
    period: SalesPeriod,
    range: UserPerformancePeriod,
  ) {
    const [
      canvasing,
      points,
      recentActivityRaw,
      totalAllTime,
      totalPointsAllTime,
    ] = await Promise.all([
      this.getCanvasingStats(userId, period, range),
      this.getPointStats(userId, period, range),
      this.getRecentSalesActivity(userId),
      prisma.canvasing.count({ where: { salesId: userId } }),
      prisma.pointClaim.aggregate({
        where: { salesId: userId, status: "APPROVED" },
        _sum: { pointValue: true },
      }),
    ]);

    return {
      canvasing,
      points,
      recentActivityRaw,
      totalAllTime,
      totalPointsAllTime,
    };
  }

  /** Mengambil aktivitas canvasing terbaru untuk user sales. */
  private getRecentSalesActivity(userId: string) {
    return prisma.canvasing.findMany({
      where: { salesId: userId },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nama: true,
        status: true,
        createdAt: true,
        alamat: true,
        pointClaims: { select: { status: true, pointValue: true } },
      },
    });
  }
}
