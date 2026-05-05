import { prisma } from "@/modules/database";

import {
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
