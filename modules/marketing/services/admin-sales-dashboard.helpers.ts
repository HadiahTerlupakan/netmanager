import { toStartOfDay } from "@/lib/utils/server-datetime";
import type { DashboardPeriod } from "./admin-sales-dashboard-range";

export const DEFAULT_CANVASING_TARGET = 50;
export const TOP_LIMIT = 3;
const WEEKLY_TREND_DAYS = 7;

export type SalesUserOverview = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  canvasingTarget: number | null;
  targetSchema: string | null;
  departments: { name: string } | null;
  sites: { code: string; name: string } | null;
};

export type SalesUserDashboard = {
  id: string;
  name: string | null;
  email: string;
  canvasingTarget: number | null;
  sites: { code: string; name: string } | null;
};

export type SiteSummary = { id: string; code: string; name: string };

export type SalesStatusCount = {
  salesId: string | null;
  status: string;
  _count: { _all: number };
};

export type LeaderboardStatusCount = {
  status: string;
  _count: { _all: number };
};

export type SiteApprovedCount = {
  salesId: string | null;
  _count: { _all: number };
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  target: number;
  approved: number;
  pending: number;
  rejected: number;
  total: number;
  points: number;
  progress: number;
};

export function getDateFilter(
  period: DashboardPeriod,
  startDate: Date,
  endDate: Date,
) {
  return period === "all"
    ? {}
    : { createdAt: { gte: startDate, lte: endDate } };
}

export function buildSalesOverview(
  salesUsers: SalesUserOverview[],
  canvasingData: SalesStatusCount[],
) {
  const users = salesUsers.map((user) => ({
    ...user,
    stats: buildOverviewUserStats(user.id, canvasingData),
  }));

  return {
    users,
    stats: {
      totalSales: salesUsers.length,
      totalTarget: salesUsers.reduce(
        (sum, user) => sum + (user.canvasingTarget || 0),
        0,
      ),
      totalAchieved: sumStatusCount(canvasingData, "APPROVED"),
      totalPending: sumStatusCount(canvasingData, "PENDING"),
    },
  };
}

export function buildLeaderboardEntry(input: {
  user: SalesUserDashboard;
  canvasingStats: LeaderboardStatusCount[];
  approvedPoints: number;
}) {
  const summary = input.canvasingStats.reduce(
    (state, stat) => accumulateLeaderboardStatus(state, stat),
    { approved: 0, pending: 0, rejected: 0, total: 0 },
  );
  const target = input.user.canvasingTarget || DEFAULT_CANVASING_TARGET;

  return {
    id: input.user.id,
    name: input.user.name || input.user.email,
    target,
    approved: summary.approved,
    pending: summary.pending,
    rejected: summary.rejected,
    total: summary.total,
    points: input.approvedPoints,
    progress: Math.round((summary.approved / target) * 100),
  };
}

export function buildRankedLeaderboard(leaderboard: LeaderboardEntry[]) {
  return [...leaderboard]
    .sort(
      (left, right) =>
        right.points - left.points || right.approved - left.approved,
    )
    .map((user, index) => ({ ...user, rank: index + 1 }));
}

export function buildTopSites(input: {
  sites: SiteSummary[];
  salesUsers: SalesUserDashboard[];
  siteStats: SiteApprovedCount[];
}) {
  const aggregation = initializeSiteAggregation();

  aggregateSiteApprovals(aggregation, input);
  aggregateSalesCounts(aggregation, input.salesUsers);

  return Object.values(aggregation)
    .sort((left, right) => right.approved - left.approved)
    .slice(0, TOP_LIMIT);
}

function initializeSiteAggregation() {
  return {} as Record<
    string,
    {
      id: string;
      code: string;
      name: string;
      approved: number;
      salesCount: number;
    }
  >;
}

function aggregateSiteApprovals(
  aggregation: ReturnType<typeof initializeSiteAggregation>,
  input: {
    sites: SiteSummary[];
    salesUsers: SalesUserDashboard[];
    siteStats: SiteApprovedCount[];
  },
) {
  input.siteStats.forEach((stat) => {
    const user = input.salesUsers.find((item) => item.id === stat.salesId);
    if (!user?.sites) return;

    if (!aggregation[user.sites.code]) {
      const fullSite = input.sites.find(
        (item) => item.code === user.sites?.code,
      );
      aggregation[user.sites.code] = {
        id: fullSite?.id || "",
        code: user.sites.code,
        name: user.sites.name,
        approved: 0,
        salesCount: 0,
      };
    }

    aggregation[user.sites.code]!.approved += stat._count._all;
  });
}

function aggregateSalesCounts(
  aggregation: ReturnType<typeof initializeSiteAggregation>,
  salesUsers: SalesUserDashboard[],
) {
  salesUsers.forEach((user) => {
    if (!user.sites) return;

    const entry = aggregation[user.sites.code];
    if (entry) {
      entry.salesCount += 1;
    }
  });
}

export function buildTeamStats(
  totalSales: number,
  leaderboard: LeaderboardEntry[],
) {
  return {
    totalSales,
    totalCanvasing: sumLeaderboardField(leaderboard, "total"),
    totalApproved: sumLeaderboardField(leaderboard, "approved"),
    totalPending: sumLeaderboardField(leaderboard, "pending"),
    totalRejected: sumLeaderboardField(leaderboard, "rejected"),
    totalPoints: sumLeaderboardField(leaderboard, "points"),
    avgProgress: calculateAverageProgress(leaderboard),
  };
}

export async function buildWeeklyTrend(
  countApproved: (startDate: Date, endDate: Date) => Promise<number>,
) {
  const now = new Date();
  const trend = [];

  for (let index = WEEKLY_TREND_DAYS - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - index);
    date.setTime(toStartOfDay(date).getTime());
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    trend.push({
      date: date.toISOString().split("T")[0],
      day: date.toLocaleDateString("id-ID", { weekday: "short" }),
      count: await countApproved(date, nextDate),
    });
  }

  return trend;
}

function buildOverviewUserStats(
  userId: string,
  canvasingData: SalesStatusCount[],
) {
  const userStats = canvasingData.filter((item) => item.salesId === userId);

  return {
    achieved: findStatusCount(userStats, "APPROVED"),
    pending: findStatusCount(userStats, "PENDING"),
  };
}

function sumStatusCount(data: SalesStatusCount[], status: string) {
  return data
    .filter((item) => item.status === status)
    .reduce((sum, item) => sum + item._count._all, 0);
}

function findStatusCount(data: SalesStatusCount[], status: string) {
  return data.find((item) => item.status === status)?._count._all || 0;
}

function accumulateLeaderboardStatus(
  state: { approved: number; pending: number; rejected: number; total: number },
  stat: LeaderboardStatusCount,
) {
  const count = stat._count._all;
  if (stat.status === "APPROVED") {
    return { ...state, approved: count, total: state.total + count };
  }

  if (stat.status === "PENDING") {
    return { ...state, pending: count, total: state.total + count };
  }

  if (stat.status === "REJECTED") {
    return { ...state, rejected: count, total: state.total + count };
  }

  return { ...state, total: state.total + count };
}

function sumLeaderboardField(
  leaderboard: LeaderboardEntry[],
  field: keyof Pick<
    LeaderboardEntry,
    "total" | "approved" | "pending" | "rejected" | "points"
  >,
) {
  return leaderboard.reduce((sum, item) => sum + item[field], 0);
}

function calculateAverageProgress(leaderboard: LeaderboardEntry[]) {
  if (leaderboard.length === 0) {
    return 0;
  }

  return Math.round(
    leaderboard.reduce((sum, item) => sum + item.progress, 0) /
      leaderboard.length,
  );
}
