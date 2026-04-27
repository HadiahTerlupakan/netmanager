import { prisma } from "@/modules/database";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";

const DEFAULT_CANVASING_TARGET = 50;
const TOP_LIMIT = 3;
const WEEKLY_TREND_DAYS = 7;

type DashboardPeriod = "day" | "week" | "month" | "custom" | "all";

type DashboardRangeInput = {
  period: DashboardPeriod;
  customStart?: string | null;
  customEnd?: string | null;
};

function buildDashboardRange(input: DashboardRangeInput) {
  const now = new Date();
  if (input.period === "day") {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      endDate: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      ),
    };
  }
  if (input.period === "week") {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
    startDate.setTime(toStartOfDay(startDate).getTime());
    return {
      startDate,
      endDate: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      ),
    };
  }
  if (input.period === "month") {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      ),
    };
  }
  if (input.period === "custom" && input.customStart && input.customEnd) {
    const startDate = new Date(input.customStart);
    startDate.setTime(toStartOfDay(startDate).getTime());
    const endDate = new Date(input.customEnd);
    endDate.setTime(toEndOfDay(endDate).getTime());
    return { startDate, endDate };
  }
  return {
    startDate:
      input.period === "all"
        ? new Date(0)
        : new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    ),
  };
}

function getDateFilter(
  period: DashboardPeriod,
  startDate: Date,
  endDate: Date,
) {
  return period === "all"
    ? {}
    : { createdAt: { gte: startDate, lte: endDate } };
}

export class AdminSalesRouteService {
  /** Get aggregate monthly sales overview for admin list route. */
  async getSalesOverview() {
    const salesUsers = await prisma.user.findMany({
      where: { isSales: true, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        canvasingTarget: true,
        targetSchema: true,
        departments: { select: { name: true } },
        sites: { select: { code: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const salesIds = salesUsers.map((user) => user.id);
    const canvasingData = await prisma.canvasing.groupBy({
      by: ["salesId", "status"],
      where: {
        salesId: { in: salesIds },
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _count: { _all: true },
    });
    const users = salesUsers.map((user) => {
      const userStats = canvasingData.filter(
        (item) => item.salesId === user.id,
      );
      return {
        ...user,
        stats: {
          achieved:
            userStats.find((item) => item.status === "APPROVED")?._count._all ||
            0,
          pending:
            userStats.find((item) => item.status === "PENDING")?._count._all ||
            0,
        },
      };
    });
    const totalAchieved = canvasingData
      .filter((item) => item.status === "APPROVED")
      .reduce((sum, item) => sum + item._count._all, 0);
    const totalPending = canvasingData
      .filter((item) => item.status === "PENDING")
      .reduce((sum, item) => sum + item._count._all, 0);
    const totalTarget = salesUsers.reduce(
      (sum, user) => sum + (user.canvasingTarget || 0),
      0,
    );
    return {
      users,
      stats: {
        totalSales: salesUsers.length,
        totalTarget,
        totalAchieved,
        totalPending,
      },
    };
  }

  /** Get admin sales dashboard data with leaderboard and trends. */
  async getSalesDashboard(input: {
    period: DashboardPeriod;
    siteId?: string | null;
    customStart?: string | null;
    customEnd?: string | null;
  }) {
    const sites = await prisma.sites.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
    const { startDate, endDate } = buildDashboardRange(input);
    const salesUsers = await prisma.user.findMany({
      where: {
        isSales: true,
        isActive: true,
        ...(input.siteId ? { siteId: input.siteId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        canvasingTarget: true,
        sites: { select: { code: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    const leaderboard = await Promise.all(
      salesUsers.map((user) =>
        this.buildLeaderboardEntry(user, input.period, startDate, endDate),
      ),
    );
    leaderboard.sort(
      (left, right) =>
        right.points - left.points || right.approved - left.approved,
    );
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      ...user,
      rank: index + 1,
    }));
    const topSites = await this.getTopSites(
      sites,
      salesUsers,
      input.period,
      startDate,
      endDate,
    );
    return {
      period: input.period,
      siteId: input.siteId || null,
      sites,
      teamStats: this.buildTeamStats(salesUsers.length, leaderboard),
      topPerformers: rankedLeaderboard.slice(0, TOP_LIMIT),
      topSites,
      leaderboard: rankedLeaderboard,
      weeklyTrend: await this.getWeeklyTrend(),
    };
  }

  /** Build a single leaderboard entry. */
  private async buildLeaderboardEntry(
    user: {
      id: string;
      name: string | null;
      email: string;
      canvasingTarget: number | null;
    },
    period: DashboardPeriod,
    startDate: Date,
    endDate: Date,
  ) {
    const dateFilter = getDateFilter(period, startDate, endDate);
    const [canvasingStats, pointsResult] = await Promise.all([
      prisma.canvasing.groupBy({
        by: ["status"],
        where: { salesId: user.id, ...dateFilter },
        _count: { _all: true },
      }),
      prisma.pointClaim.aggregate({
        where: { salesId: user.id, status: "APPROVED", ...dateFilter },
        _sum: { pointValue: true },
      }),
    ]);
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let total = 0;
    canvasingStats.forEach((stat) => {
      const count = stat._count._all;
      total += count;
      if (stat.status === "APPROVED") approved = count;
      else if (stat.status === "PENDING") pending = count;
      else if (stat.status === "REJECTED") rejected = count;
    });
    const target = user.canvasingTarget || DEFAULT_CANVASING_TARGET;
    return {
      id: user.id,
      name: user.name || user.email,
      target,
      approved,
      pending,
      rejected,
      total,
      points: pointsResult._sum?.pointValue || 0,
      progress: Math.round((approved / target) * 100),
    };
  }

  /** Build top site ranking from approved canvasing totals. */
  private async getTopSites(
    sites: Array<{ id: string; code: string; name: string }>,
    salesUsers: Array<{
      id: string;
      sites: { code: string; name: string } | null;
    }>,
    period: DashboardPeriod,
    startDate: Date,
    endDate: Date,
  ) {
    const siteStats = await prisma.canvasing.groupBy({
      by: ["salesId"],
      where: {
        status: "APPROVED",
        ...getDateFilter(period, startDate, endDate),
      },
      _count: { _all: true },
    });
    const aggregation: Record<
      string,
      {
        id: string;
        code: string;
        name: string;
        approved: number;
        salesCount: number;
      }
    > = {};
    siteStats.forEach((stat) => {
      const user = salesUsers.find((item) => item.id === stat.salesId);
      if (!user?.sites) return;
      const site = user.sites;
      if (!aggregation[site.code]) {
        const fullSite = sites.find((item) => item.code === site.code);
        aggregation[site.code] = {
          id: fullSite?.id || "",
          code: site.code,
          name: site.name,
          approved: 0,
          salesCount: 0,
        };
      }
      aggregation[site.code]!.approved += stat._count._all;
    });
    salesUsers.forEach((user) => {
      if (!user.sites) return;
      const entry = aggregation[user.sites.code];
      if (entry) entry.salesCount += 1;
    });
    return Object.values(aggregation)
      .sort((left, right) => right.approved - left.approved)
      .slice(0, TOP_LIMIT);
  }

  /** Build team overview numbers. */
  private buildTeamStats(
    totalSales: number,
    leaderboard: Array<{
      total: number;
      approved: number;
      pending: number;
      rejected: number;
      points: number;
      progress: number;
    }>,
  ) {
    return {
      totalSales,
      totalCanvasing: leaderboard.reduce((sum, item) => sum + item.total, 0),
      totalApproved: leaderboard.reduce((sum, item) => sum + item.approved, 0),
      totalPending: leaderboard.reduce((sum, item) => sum + item.pending, 0),
      totalRejected: leaderboard.reduce((sum, item) => sum + item.rejected, 0),
      totalPoints: leaderboard.reduce((sum, item) => sum + item.points, 0),
      avgProgress:
        leaderboard.length > 0
          ? Math.round(
              leaderboard.reduce((sum, item) => sum + item.progress, 0) /
                leaderboard.length,
            )
          : 0,
    };
  }

  /** Get approved canvasing trend for the last seven days. */
  private async getWeeklyTrend() {
    const now = new Date();
    const trend = [];
    for (let index = WEEKLY_TREND_DAYS - 1; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - index);
      date.setTime(toStartOfDay(date).getTime());
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const count = await prisma.canvasing.count({
        where: { status: "APPROVED", createdAt: { gte: date, lt: nextDate } },
      });
      trend.push({
        date: date.toISOString().split("T")[0],
        day: date.toLocaleDateString("id-ID", { weekday: "short" }),
        count,
      });
    }
    return trend;
  }
}
