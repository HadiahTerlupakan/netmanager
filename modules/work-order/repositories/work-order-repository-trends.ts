import { Prisma, type PrismaClient } from "@prisma/client";
import {
  buildAnalyticsWhere,
  buildMonthKeys,
  createIssueMonthMap,
  createPerformanceMonthMap,
  createTypeMonthMap,
  createVolumeMonthMap,
  formatMonthKey,
  formatMonthLabel,
  mapWorkOrderTypeLabel,
  calculateMinutesBetween,
} from "./work-order-repository-analytics-helpers";

const ISSUE_CLASSIFICATIONS = [
  { label: "LOS/Redaman", keywords: ["los", "redaman", "signal"] },
  { label: "Internet Lambat", keywords: ["lambat", "slow", "speed"] },
  { label: "Koneksi Putus", keywords: ["putus", "disconnect", "dc"] },
  { label: "Perangkat", keywords: ["router", "modem", "onu"] },
  { label: "Billing", keywords: ["tagihan", "billing", "payment"] },
  { label: "Instalasi", keywords: ["install", "pasang"] },
] as const;

/** Get volume trend for created, completed, and requested work orders. */
export async function getVolumeTrend(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date,
  departmentId?: string,
  siteId?: string,
) {
  const where = buildAnalyticsWhere({ departmentId, siteId });
  const [createdWOs, completedWOs, requestedWOs] = await Promise.all([
    prisma.workOrders.findMany({
      where: { ...where, createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
    }),
    prisma.workOrders.findMany({
      where: {
        ...where,
        completedAt: { gte: startDate, lte: endDate },
        status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] },
      },
      select: { completedAt: true },
    }),
    prisma.workOrders.findMany({
      where: {
        ...where,
        status: "REQUESTED",
        requestedAt: { gte: startDate, lte: endDate },
      },
      select: { requestedAt: true },
    }),
  ]);

  const monthMap = createVolumeMonthMap(buildMonthKeys(startDate, endDate));
  createdWOs.forEach((item) =>
    incrementVolumeBucket(monthMap, item.createdAt, "created"),
  );
  completedWOs.forEach((item) => {
    if (item.completedAt)
      incrementVolumeBucket(monthMap, item.completedAt, "completed");
  });
  requestedWOs.forEach((item) => {
    if (item.requestedAt)
      incrementVolumeBucket(monthMap, item.requestedAt, "requested");
  });

  return Object.entries(monthMap).map(([monthKey, counts]) => ({
    month: formatMonthLabel(monthKey),
    created: counts.created,
    completed: counts.completed,
    requested: counts.requested,
  }));
}

/** Get issue trend by month. */
export async function getIssueTrend(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date,
  departmentId?: string,
  siteId?: string,
) {
  const where = buildAnalyticsWhere({ departmentId, siteId });
  const workOrders = await prisma.workOrders.findMany({
    where: { ...where, createdAt: { gte: startDate, lte: endDate } },
    select: { title: true, createdAt: true },
  });

  const monthIssues = createIssueMonthMap(buildMonthKeys(startDate, endDate));
  workOrders.forEach((workOrder) => addIssueTrendItem(monthIssues, workOrder));

  return Object.entries(monthIssues).map(([monthKey, issues]) => ({
    month: formatMonthLabel(monthKey),
    issues: Object.entries(issues)
      .map(([issue, count]) => ({ issue, count }))
      .sort((left, right) => right.count - left.count),
  }));
}

/** Get performance trend by completion month. */
export async function getPerformanceTrend(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date,
  departmentId?: string,
  siteId?: string,
) {
  const where = buildAnalyticsWhere({ departmentId, siteId });
  const completedWOs = await prisma.workOrders.findMany({
    where: {
      ...where,
      completedAt: { gte: startDate, lte: endDate },
      status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] },
    },
    select: {
      completedAt: true,
      startedAt: true,
      actualHours: true,
      rating: true,
    },
  });

  const monthStats = createPerformanceMonthMap(
    buildMonthKeys(startDate, endDate),
  );
  completedWOs.forEach((workOrder) =>
    updatePerformanceTrend(monthStats, workOrder),
  );

  return Object.entries(monthStats).map(([monthKey, stats]) => ({
    month: formatMonthLabel(monthKey),
    avgCompletionHours:
      stats.count > 0
        ? Math.round((stats.totalHours / stats.count) * 10) / 10
        : 0,
    avgRating:
      stats.ratingCount > 0
        ? Math.round((stats.totalRating / stats.ratingCount) * 10) / 10
        : null,
    totalCompleted: stats.count,
  }));
}

/** Get work order type trend by month. */
export async function getTypeTrend(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date,
  departmentId?: string,
  siteId?: string,
) {
  const where = buildAnalyticsWhere({ departmentId, siteId });
  const workOrders = await prisma.workOrders.findMany({
    where: { ...where, createdAt: { gte: startDate, lte: endDate } },
    select: { type: true, createdAt: true },
  });

  const monthTypes = createTypeMonthMap(buildMonthKeys(startDate, endDate));
  workOrders.forEach((workOrder) => addTypeTrendItem(monthTypes, workOrder));

  return Object.entries(monthTypes).map(([monthKey, typeMap]) => ({
    month: formatMonthLabel(monthKey),
    types: Object.entries(typeMap)
      .map(([type, count]) => ({ type: mapWorkOrderTypeLabel(type), count }))
      .sort((left, right) => right.count - left.count),
  }));
}

function classifyIssue(title: string): string {
  const lowerTitle = title.toLowerCase();

  return findIssueLabel(lowerTitle) || "Lainnya";
}

function findIssueLabel(title: string): string | undefined {
  return ISSUE_CLASSIFICATIONS.find(({ keywords }) =>
    matchesIssueKeywords(title, keywords),
  )?.label;
}

function matchesIssueKeywords(
  title: string,
  keywords: readonly string[],
): boolean {
  return keywords.some((keyword) => title.includes(keyword));
}

function addIssueTrendItem(
  monthIssues: Record<string, Record<string, number>>,
  workOrder: { title: string; createdAt: Date },
) {
  const monthKey = formatMonthKey(new Date(workOrder.createdAt));
  if (!monthIssues[monthKey]) return;

  const issue = classifyIssue(workOrder.title);
  monthIssues[monthKey][issue] = (monthIssues[monthKey][issue] || 0) + 1;
}

function addTypeTrendItem(
  monthTypes: Record<string, Record<string, number>>,
  workOrder: { type: string | null; createdAt: Date },
) {
  const monthKey = formatMonthKey(new Date(workOrder.createdAt));
  if (!monthTypes[monthKey]) return;

  const type = workOrder.type || "OTHER";
  monthTypes[monthKey][type] = (monthTypes[monthKey][type] || 0) + 1;
}

function incrementVolumeBucket(
  monthMap: Record<
    string,
    { created: number; completed: number; requested: number }
  >,
  date: Date,
  field: "created" | "completed" | "requested",
) {
  const monthKey = formatMonthKey(new Date(date));
  if (!monthMap[monthKey]) return;
  monthMap[monthKey][field] += 1;
}

type PerformanceTrendItem = {
  completedAt: Date | null;
  startedAt: Date | null;
  actualHours: Prisma.Decimal | number | null;
  rating: Prisma.Decimal | number | null;
};

function updatePerformanceTrend(
  monthStats: Record<
    string,
    {
      totalHours: number;
      totalRating: number;
      ratingCount: number;
      count: number;
    }
  >,
  workOrder: PerformanceTrendItem,
) {
  if (!workOrder.completedAt) return;

  const monthKey = formatMonthKey(new Date(workOrder.completedAt));
  const stat = monthStats[monthKey];
  if (!stat) return;

  stat.count += 1;
  stat.totalHours += calculateCompletionHours(workOrder);
  if (workOrder.rating) {
    stat.totalRating += Number(workOrder.rating);
    stat.ratingCount += 1;
  }
}

function calculateCompletionHours(workOrder: PerformanceTrendItem) {
  if (workOrder.actualHours) return Number(workOrder.actualHours);
  if (workOrder.startedAt && workOrder.completedAt) {
    return (
      calculateMinutesBetween(workOrder.startedAt, workOrder.completedAt) / 60
    );
  }
  return 0;
}
