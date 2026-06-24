import { prisma } from "@/modules/database";

import {
  buildCompletedWorkOrderDateFilter,
  buildLeadWorkOrderWhere,
  buildOverallWorkOrderWhere,
  buildSupportWorkOrderWhere,
  buildWorkOrderStats,
  getCompletedWorkOrderStatuses,
  type UserPerformancePeriod,
} from "./AdminUserPerformanceRouteService.helpers";

/** Ambil statistik work-order untuk seorang user. */
export async function getWorkOrderStats(
  userId: string,
  period: UserPerformancePeriod,
) {
  const leadWhere = buildLeadWorkOrderWhere(userId, period);
  const supportWhere = buildSupportWorkOrderWhere(userId, period);
  const overallWhere = buildOverallWorkOrderWhere(userId, period);
  const completedStatuses = getCompletedWorkOrderStatuses();
  const completedDateFilter = buildCompletedWorkOrderDateFilter(period);

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
        assignedToId: userId,
        status: { in: completedStatuses },
        ...completedDateFilter,
      },
    }),
    prisma.workOrders.count({ where: supportWhere }),
    prisma.workOrders.count({
      where: {
        assignedToId: { not: userId },
        assignments: { some: { userId } },
        status: { in: completedStatuses },
        ...completedDateFilter,
      },
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
