import { prisma } from "@/modules/database";
import {
  buildDashboardRange,
  type DashboardPeriod,
} from "./admin-sales-dashboard-range";
import {
  buildLeaderboardEntry,
  buildRankedLeaderboard,
  buildSalesOverview,
  buildTeamStats,
  buildTopSites,
  buildWeeklyTrend,
  getDateFilter,
  TOP_LIMIT,
} from "./admin-sales-dashboard.helpers";

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
    const canvasingData = await prisma.canvasing.groupBy({
      by: ["salesId", "status"],
      where: {
        salesId: { in: salesUsers.map((user) => user.id) },
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _count: { _all: true },
    });

    return buildSalesOverview(salesUsers, canvasingData);
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
      salesUsers.map(async (user) => {
        const dateFilter = getDateFilter(input.period, startDate, endDate);
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

        return buildLeaderboardEntry({
          user,
          canvasingStats,
          approvedPoints: pointsResult._sum?.pointValue || 0,
        });
      }),
    );
    const rankedLeaderboard = buildRankedLeaderboard(leaderboard);
    const siteStats = await prisma.canvasing.groupBy({
      by: ["salesId"],
      where: {
        status: "APPROVED",
        ...getDateFilter(input.period, startDate, endDate),
      },
      _count: { _all: true },
    });

    return {
      period: input.period,
      siteId: input.siteId || null,
      sites,
      teamStats: buildTeamStats(salesUsers.length, leaderboard),
      topPerformers: rankedLeaderboard.slice(0, TOP_LIMIT),
      topSites: buildTopSites({ sites, salesUsers, siteStats }),
      leaderboard: rankedLeaderboard,
      weeklyTrend: await buildWeeklyTrend((date, nextDate) =>
        prisma.canvasing.count({
          where: { status: "APPROVED", createdAt: { gte: date, lt: nextDate } },
        }),
      ),
    };
  }
}
