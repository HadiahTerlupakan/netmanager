import { prisma } from "@/modules/database";
import { SalesAnalyticsRepository } from "../repositories/SalesAnalyticsRepository";
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
  constructor(
    private readonly repository: SalesAnalyticsRepository = new SalesAnalyticsRepository(
      prisma,
    ),
  ) {}

  /** Get aggregate monthly sales overview for admin list route. */
  async getSalesOverview(input?: { allowedSiteIds?: string[] }) {
    const salesUsers = await this.repository.findSalesUsersForOverview(input);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const canvasingData = await this.repository.groupCanvasingByStatus({
      salesUserIds: salesUsers.map((user) => user.id),
      range: { startDate: startOfMonth, endDate: endOfMonth },
    });

    return buildSalesOverview(salesUsers, canvasingData);
  }

  /** Get admin sales dashboard data with leaderboard and trends. */
  async getSalesDashboard(input: {
    period: DashboardPeriod;
    siteId?: string | null;
    customStart?: string | null;
    customEnd?: string | null;
    allowedSiteIds?: string[];
  }) {
    const sites = await this.repository.findActiveSites({
      allowedSiteIds: input.allowedSiteIds,
    });
    const { startDate, endDate } = buildDashboardRange(input);
    const salesUsers = await this.repository.findSalesUsersForDashboard({
      allowedSiteIds: input.allowedSiteIds,
      siteId: input.siteId,
    });

    const salesUserIds = salesUsers.map((user) => user.id);
    const dateFilter = getDateFilter(input.period, startDate, endDate);

    const leaderboard = await Promise.all(
      salesUsers.map(async (user) => {
        const [canvasingStats, pointsResult] = await Promise.all([
          this.repository.groupCanvasingForSales({
            salesId: user.id,
            dateFilter,
          }),
          this.repository.sumApprovedPointsForSales({
            salesId: user.id,
            dateFilter,
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

    const siteStats = await this.repository.groupApprovedCanvasingBySales({
      salesUserIds,
      dateFilter,
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
        this.repository.countApprovedCanvasingInRange({
          salesUserIds,
          startDate: date,
          endDate: nextDate,
        }),
      ),
    };
  }
}
