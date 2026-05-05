import { prisma } from "@/modules/database";

import {
  buildSalesPerformanceSummary,
  mapCanvasingStats,
  mapPointStats,
  type SalesPeriod,
  type UserPerformancePeriod,
} from "./AdminUserPerformanceRouteService.helpers";

/** Ambil statistik canvasing untuk periode performa sales. */
export async function getCanvasingStats(
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

  return mapCanvasingStats(
    canvasingStats as Array<{ status: string; _count: { _all: number } }>,
  );
}

/** Ambil statistik point claim untuk periode performa sales. */
export async function getPointStats(
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

  return mapPointStats(
    pointClaimStats as Array<{
      status: string;
      _count: { _all: number };
      _sum: { pointValue: number | null };
    }>,
  );
}

/** Mengambil aktivitas canvasing terbaru untuk user sales. */
export function getRecentSalesActivity(userId: string) {
  return prisma.canvasing.findMany({
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
  });
}

/** Memuat seluruh query performa sales yang berjalan paralel. */
export async function loadSalesPerformanceData(
  userId: string,
  period: SalesPeriod,
  range: UserPerformancePeriod,
) {
  const [
    canvasing,
    points,
    recentActivityRaw,
    totalAllTime,
    totalPointsAllTime,
  ] = await Promise.all([
    getCanvasingStats(userId, period, range),
    getPointStats(userId, period, range),
    getRecentSalesActivity(userId),
    prisma.canvasing.count({ where: { salesId: userId } }),
    prisma.pointClaim.aggregate({
      where: { salesId: userId, status: "APPROVED" },
      _sum: { pointValue: true },
    }),
  ]);

  return {
    canvasing,
    points,
    recentActivityRaw,
    totalAllTime,
    totalPointsAllTime,
  };
}

/** Bangun ringkasan performa sales dari user dan hasil query. */
export function buildSalesPerformanceResult(input: {
  user: { id: string; name: string | null; canvasingTarget: number | null };
  period: SalesPeriod;
  salesData: Awaited<ReturnType<typeof loadSalesPerformanceData>>;
}) {
  return buildSalesPerformanceSummary({
    user: input.user,
    period: input.period,
    canvasing: input.salesData.canvasing,
    points: input.salesData.points,
    totalAllTime: input.salesData.totalAllTime,
    totalPointsAllTime:
      input.salesData.totalPointsAllTime._sum?.pointValue || 0,
    recentActivityRaw: input.salesData.recentActivityRaw,
  });
}
