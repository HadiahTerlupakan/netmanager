import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";

type ClaimStatus = "APPROVED" | "PENDING" | string;

type ClaimSummaryInput = {
  status: ClaimStatus;
  pointValue: number | null;
};

type WorkOrderStatsInput = {
  pending?: number;
  inProgress?: number;
  completed?: number;
  verified?: number;
  closed?: number;
};

type AttendanceDailyStatsInput = {
  present?: number;
  late?: number;
  absent?: number;
};

type AttendanceUserStatInput = {
  userId: string | null;
  _count: {
    _all: number;
  };
};

type WorkOrderUserStatInput = {
  userId: string | null;
  count: number;
};

type TopEmployeeScore = {
  attendance: number;
  workOrder: number;
  total: number;
};

/** Build today's date range for dashboard queries. */
export function buildTodayRange() {
  const now = new Date();
  return {
    startOfDay: new Date(toStartOfDay(now).getTime()),
    endOfDay: new Date(toEndOfDay(now).getTime()),
  };
}

/** Build recent date range based on day offset. */
export function buildRecentRange(days: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  return { startDate, endDate };
}

/** Summarize marketing claims into dashboard counters. */
export function summarizeMarketingClaims(claims: ClaimSummaryInput[]) {
  return claims.reduce(
    (summary, claim) => {
      if (claim.status === "APPROVED") {
        summary.totalPoints += claim.pointValue || 0;
        summary.approvedClaims += 1;
      } else if (claim.status === "PENDING") {
        summary.pendingClaims += 1;
      }

      return summary;
    },
    {
      totalPoints: 0,
      pendingClaims: 0,
      approvedClaims: 0,
    },
  );
}

/** Summarize work order statistics into dashboard cards. */
export function summarizeWorkOrders(stats: WorkOrderStatsInput) {
  return {
    pending: stats.pending || 0,
    inProgress: stats.inProgress || 0,
    completed:
      (stats.completed || 0) + (stats.verified || 0) + (stats.closed || 0),
  };
}

/** Summarize daily attendance into dashboard cards. */
export function summarizeAttendance(stats?: AttendanceDailyStatsInput) {
  return {
    present: stats?.present || 0,
    late: stats?.late || 0,
    absent: stats?.absent || 0,
  };
}

/** Build score map for employee leaderboard ranking. */
export function buildTopEmployeeScores(
  attendanceStats: AttendanceUserStatInput[],
  workOrderStats: WorkOrderUserStatInput[],
) {
  const scores = new Map<string, TopEmployeeScore>();

  attendanceStats.forEach((stat) => {
    if (!stat.userId) return;

    const current = scores.get(stat.userId) || {
      attendance: 0,
      workOrder: 0,
      total: 0,
    };

    current.attendance = stat._count._all;
    current.total += stat._count._all;
    scores.set(stat.userId, current);
  });

  workOrderStats.forEach((stat) => {
    if (!stat.userId) return;

    const current = scores.get(stat.userId) || {
      attendance: 0,
      workOrder: 0,
      total: 0,
    };

    current.workOrder = stat.count;
    current.total += stat.count;
    scores.set(stat.userId, current);
  });

  return scores;
}

/** Sort employee scores and cap the leaderboard size. */
export function sortTopEmployeeScores(
  scores: Map<string, TopEmployeeScore>,
  limit: number,
) {
  return Array.from(scores.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit);
}
