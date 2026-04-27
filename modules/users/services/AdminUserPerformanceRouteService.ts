import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import { toStartOfDay } from "@/lib/utils/server-datetime";

const DEFAULT_TARGET_HOUR = 8;
const DEFAULT_CANVASING_TARGET = 50;
const COMPLETED_WORK_ORDER_STATUSES = [
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
] as const;
const MINUTES_PER_HOUR = 60;
const ROUNDING_PRECISION = 10;

type UserPerformancePeriod = {
  startDate: Date;
  endDate: Date;
};

type SalesPeriod = "day" | "week" | "month" | "all";

function roundSingleDecimal(value: number) {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

function buildSalesPeriodRange(period: SalesPeriod) {
  const now = new Date();
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
  );
  if (period === "day") {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      endDate,
    };
  }
  if (period === "week") {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
    startDate.setTime(toStartOfDay(startDate).getTime());
    return { startDate, endDate };
  }
  if (period === "month") {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate,
    };
  }
  return { startDate: new Date(0), endDate };
}

function buildPerformancePeriod(params: {
  dateFrom?: string | null;
  dateTo?: string | null;
  period?: string | null;
}): UserPerformancePeriod {
  if (params.dateFrom && params.dateTo) {
    const startDate = new Date(params.dateFrom);
    const endDate = new Date(params.dateTo);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }
  if (params.period === "month") {
    const startDate = new Date();
    startDate.setDate(1);
    startDate.setTime(toStartOfDay(startDate).getTime());
    return { startDate, endDate: new Date() };
  }
  return { startDate: new Date(0), endDate: new Date() };
}

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
    const [
      canvasing,
      points,
      recentActivityRaw,
      totalAllTime,
      totalPointsAllTime,
    ] = await Promise.all([
      this.getCanvasingStats(userId, period, range),
      this.getPointStats(userId, period, range),
      prisma.canvasing.findMany({
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
      }),
      prisma.canvasing.count({ where: { salesId: userId } }),
      prisma.pointClaim.aggregate({
        where: { salesId: userId, status: "APPROVED" },
        _sum: { pointValue: true },
      }),
    ]);

    const target = user.canvasingTarget || DEFAULT_CANVASING_TARGET;
    return {
      user,
      period,
      target,
      canvasing: {
        ...canvasing,
        progress: Math.round((canvasing.approved / target) * 100),
      },
      points,
      totalAllTime,
      totalPointsAllTime: totalPointsAllTime._sum?.pointValue || 0,
      recentActivity: recentActivityRaw.map((activity) => ({
        id: activity.id,
        pelangganName: activity.nama,
        status: activity.status,
        createdAt: activity.createdAt,
        address: activity.alamat,
        pointClaim: (activity as Record<string, unknown>).pointClaims || null,
      })),
    };
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
    const attendance = { present: 0, late: 0, absent: 0, alpha: 0, total: 0 };
    attendanceStats.forEach((stat) => {
      const count = (stat._count as { _all: number })._all || 0;
      if (stat.status === "ON_TIME") attendance.present += count;
      else if (stat.status === "LATE") attendance.late += count;
      else if (stat.status === "ABSENT" || stat.status === "DAY_OFF")
        attendance.absent += count;
      else if (stat.status === "ALPHA") attendance.alpha += count;
    });
    attendance.total =
      attendance.present +
      attendance.late +
      attendance.absent +
      attendance.alpha;
    return attendance;
  }

  /** Get flexible working-hour statistics. */
  private async getFlexibleStats(
    userId: string,
    workingHourMode: string,
    flexibleTargetHour: number,
    period: UserPerformancePeriod,
  ) {
    const emptyStats = {
      totalMinutesThisMonth: 0,
      totalHoursThisMonth: 0,
      daysWorkedThisMonth: 0,
      avgHoursPerDay: 0,
      targetHoursPerDay: flexibleTargetHour,
      targetPercentage: 0,
    };
    if (workingHourMode !== "FLEXIBLE") return emptyStats;
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
    const daysWorked = attendances.length;
    const avgHoursPerDay =
      daysWorked > 0 ? totalMinutes / daysWorked / MINUTES_PER_HOUR : 0;
    const targetPercentage =
      flexibleTargetHour > 0
        ? Math.round((avgHoursPerDay / flexibleTargetHour) * 100)
        : 0;
    return {
      totalMinutesThisMonth: Math.round(totalMinutes),
      totalHoursThisMonth: roundSingleDecimal(totalMinutes / MINUTES_PER_HOUR),
      daysWorkedThisMonth: daysWorked,
      avgHoursPerDay: roundSingleDecimal(avgHoursPerDay),
      targetHoursPerDay: flexibleTargetHour,
      targetPercentage: Math.min(targetPercentage, 100),
    };
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
    const leaves = {
      cuti: 0,
      sakit: 0,
      izin: 0,
      lainnya: 0,
      tukarLibur: 0,
      total: 0,
    };
    leaveStats.forEach((stat) => {
      const count = (stat._count as { _all: number })._all || 0;
      leaves.total += count;
      if (stat.type === "CUTI") leaves.cuti = count;
      else if (stat.type === "SAKIT") leaves.sakit = count;
      else if (stat.type === "IZIN") leaves.izin = count;
      else if (stat.type === "LAINNYA") leaves.lainnya = count;
      else if (stat.type === "TUKAR_LIBUR") leaves.tukarLibur = count;
    });
    return leaves;
  }

  /** Get work-order statistics for a user. */
  private async getWorkOrderStats(
    userId: string,
    period: UserPerformancePeriod,
  ) {
    const dateFilter = {
      createdAt: { gte: period.startDate, lte: period.endDate },
    };
    const leadWhere = { assignedToId: userId, ...dateFilter };
    const supportWhere = {
      assignedToId: { not: userId },
      assignments: { some: { userId } },
      ...dateFilter,
    };
    const overallWhere: Prisma.WorkOrdersWhereInput = {
      OR: [{ assignedToId: userId }, { assignments: { some: { userId } } }],
      ...dateFilter,
    };
    const [
      leadTotal,
      leadCompleted,
      supportTotal,
      supportCompleted,
      overallRating,
    ] = await Promise.all([
      prisma.workOrders.count({ where: leadWhere }),
      prisma.workOrders.count({
        where: {
          ...leadWhere,
          status: { in: [...COMPLETED_WORK_ORDER_STATUSES] },
        },
      }),
      prisma.workOrders.count({ where: supportWhere }),
      prisma.workOrders.count({
        where: {
          ...supportWhere,
          status: { in: [...COMPLETED_WORK_ORDER_STATUSES] },
        },
      }),
      prisma.workOrders.aggregate({
        where: overallWhere,
        _avg: { rating: true },
      }),
    ]);
    const totalAssigned = leadTotal + supportTotal;
    const completed = leadCompleted + supportCompleted;
    return {
      totalAssigned,
      completed,
      lead: { total: leadTotal, completed: leadCompleted },
      support: { total: supportTotal, completed: supportCompleted },
      completionRate:
        totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0,
      avgRating: overallRating._avg?.rating
        ? Number(overallRating._avg.rating.toFixed(1))
        : 0,
    };
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
    const canvasing = { approved: 0, rejected: 0, pending: 0, total: 0 };
    canvasingStats.forEach((stat) => {
      const count =
        ((stat._count as Record<string, unknown>)._all as number) || 0;
      canvasing.total += count;
      if (stat.status === "APPROVED") canvasing.approved = count;
      else if (stat.status === "REJECTED") canvasing.rejected = count;
      else if (stat.status === "PENDING") canvasing.pending = count;
    });
    return canvasing;
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
    const points = {
      approved: 0,
      approvedValue: 0,
      rejected: 0,
      pending: 0,
      pendingValue: 0,
      total: 0,
      totalValue: 0,
    };
    pointClaimStats.forEach((stat) => {
      const count =
        ((stat._count as Record<string, unknown>)._all as number) || 0;
      const value = stat._sum?.pointValue || 0;
      points.total += count;
      points.totalValue += value;
      if (stat.status === "APPROVED") {
        points.approved = count;
        points.approvedValue = value;
      } else if (stat.status === "REJECTED") {
        points.rejected = count;
      } else if (stat.status === "PENDING") {
        points.pending = count;
        points.pendingValue = value;
      }
    });
    return points;
  }
}
