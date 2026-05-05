import type { PrismaClient } from "@prisma/client";
import {
  buildAdminKpiDates,
  buildAnalyticsWhere,
  buildStartOfWeek,
  calculateAverageCanvasingMinutes,
  calculateAverageVerificationMinutes,
} from "./work-order-repository-analytics-helpers";

/** Get admin KPI statistics for dashboard cards. */
export async function getAdminKPIStats(
  prisma: PrismaClient,
  departmentId?: string,
  siteId?: string,
): Promise<{
  pendingVerification: number;
  avgVerificationTimeMinutes: number;
  avgCanvasingTimeMinutes: number;
  canvasingApprovedToday: number;
  canvasingApprovedThisWeek: number;
}> {
  const { today, dateFrom, dateTo } = buildAdminKpiDates();
  const where = buildAnalyticsWhere({ departmentId, siteId });

  const [
    pendingVerification,
    verifiedWorkOrders,
    approvedCanvasing,
    canvasingApprovedToday,
  ] = await Promise.all([
    prisma.workOrders.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.workOrders.findMany({
      where: {
        ...where,
        status: { in: ["VERIFIED", "CLOSED"] },
        completedAt: { not: null },
        verifiedAt: { not: null },
      },
      select: {
        completedAt: true,
        verifiedAt: true,
      },
    }),
    prisma.canvasing.findMany({
      where: {
        approvedAt: { not: null },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: { createdAt: true, approvedAt: true },
    }),
    prisma.canvasing.count({
      where: {
        approvedAt: { gte: today },
      },
    }),
  ]);

  return {
    pendingVerification,
    avgVerificationTimeMinutes:
      calculateAverageVerificationMinutes(verifiedWorkOrders),
    avgCanvasingTimeMinutes:
      calculateAverageCanvasingMinutes(approvedCanvasing),
    canvasingApprovedToday,
    canvasingApprovedThisWeek: await prisma.canvasing.count({
      where: {
        approvedAt: { gte: buildStartOfWeek(today) },
      },
    }),
  };
}
