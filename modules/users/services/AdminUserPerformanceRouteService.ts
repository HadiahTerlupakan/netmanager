import { prisma } from "@/modules/database";
import {
  buildPerformancePeriod,
  buildSalesPeriodRange,
  type SalesPeriod,
} from "./AdminUserPerformanceRouteService.helpers";
import {
  getAttendanceStats,
  getFlexibleStats,
  getLeaveStats,
} from "./admin-user-performance.attendance";
import {
  buildSalesPerformanceResult,
  loadSalesPerformanceData,
} from "./admin-user-performance.sales";
import { getWorkOrderStats } from "./admin-user-performance.workorder";

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
      getAttendanceStats(userId, period),
      getFlexibleStats({
        userId,
        workingHourMode: user.workingHourMode || "FIXED",
        flexibleTargetHour: user.flexibleTargetHour || DEFAULT_TARGET_HOUR,
        period,
      }),
      getLeaveStats(userId, period),
      getWorkOrderStats(userId, period),
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
    const salesData = await loadSalesPerformanceData(userId, period, range);

    return buildSalesPerformanceResult({ user, period, salesData });
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
}
