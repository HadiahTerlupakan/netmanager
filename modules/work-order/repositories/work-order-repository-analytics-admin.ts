import type { PrismaClient } from "@prisma/client";
import {
  calculateAdminScore,
  calculateMinutesBetween,
  calculateRoundedAverage,
  createFallbackSalesKPIStats,
  createInitialUserKPIStats,
  ensureCanvasingStats,
} from "./work-order-repository-analytics-helpers";

/** Get admin response statistics with weighted KPI metrics. */
export async function getAdminResponseStats(
  prisma: PrismaClient,
  dateFrom: Date,
  dateTo: Date,
  departmentId?: string,
): Promise<
  Array<{
    userId: string;
    userName: string;
    role: string;
    totalScore: number;
    totalResponses: number;
    avgResponseTimeMinutes: number;
    verifiedCount: number;
    avgVerifyTimeMinutes: number;
    completedCount: number;
    canvasingCount: number;
    avgCanvasingTimeMinutes: number;
  }>
> {
  const updates = await fetchAdminResponseUpdates(prisma, dateFrom, dateTo);

  const userStats = accumulateAdminResponseStats(updates, departmentId);
  await mergeCanvasingApprovalStats(prisma, userStats, dateFrom, dateTo);
  await hydrateUnknownSalesUsers(prisma, userStats);

  return Object.entries(userStats)
    .map(([userId, stat]) => ({
      userId,
      userName: stat.name,
      role: stat.role,
      isTechnical: stat.isTechnical || false,
      totalScore: calculateAdminScore(stat),
      totalResponses: stat.responseCount,
      avgResponseTimeMinutes: calculateRoundedAverage(
        stat.totalResponseTime,
        stat.responseCount,
      ),
      verifiedCount: stat.verifiedCount,
      avgVerifyTimeMinutes: calculateRoundedAverage(
        stat.totalVerifyTime,
        stat.verifiedCount,
      ),
      completedCount: stat.completedCount,
      canvasingCount: stat.canvasingCount || 0,
      avgCanvasingTimeMinutes: calculateRoundedAverage(
        stat.totalCanvasingTime || 0,
        stat.canvasingCount || 0,
      ),
    }))
    .filter((stat) => stat.totalScore > 0)
    .sort((left, right) => right.totalScore - left.totalScore);
}

type AdminUpdate = Awaited<
  ReturnType<typeof fetchAdminResponseUpdates>
>[number];
type CanvasingApproval = {
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};
type KPIStatMap = Record<string, ReturnType<typeof createInitialUserKPIStats>>;

async function fetchAdminResponseUpdates(
  prisma: PrismaClient,
  dateFrom: Date,
  dateTo: Date,
) {
  return prisma.workOrderUpdates.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      createdById: { not: null },
    },
    include: {
      workOrders: {
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
          verifiedAt: true,
          departmentId: true,
          status: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: {
            select: {
              name: true,
              isTechnical: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

function accumulateAdminResponseStats(
  updates: AdminUpdate[],
  departmentId?: string,
): KPIStatMap {
  const userStats: KPIStatMap = {};
  const processedResponsePairs = new Set<string>();
  const processedVerifyPairs = new Set<string>();

  updates.forEach((update) => {
    if (!update.user || !update.createdById) return;
    if (departmentId && update.workOrders.departmentId !== departmentId) return;

    initializeUserStats(userStats, update);
    trackResponseStat(userStats, update, processedResponsePairs);
    trackVerificationStat(userStats, update, processedVerifyPairs);
    trackCompletionStat(userStats, update);
  });

  return userStats;
}

function initializeUserStats(userStats: KPIStatMap, update: AdminUpdate) {
  const userId = update.createdById;
  if (!userId || userStats[userId]) return;

  userStats[userId] = createInitialUserKPIStats({
    name: update.user?.name,
    role: update.user?.role?.name,
    isTechnical: update.user?.role?.isTechnical,
  });
}

function trackResponseStat(
  userStats: KPIStatMap,
  update: AdminUpdate,
  processedResponsePairs: Set<string>,
) {
  const userId = update.createdById;
  if (!userId) return;

  const responseKey = `response-${update.workOrderId}-${userId}`;
  if (processedResponsePairs.has(responseKey)) return;

  const responseTimeMinutes = calculateMinutesBetween(
    new Date(update.workOrders.createdAt),
    new Date(update.createdAt),
  );
  if (responseTimeMinutes < 0) return;

  userStats[userId].totalResponseTime += responseTimeMinutes;
  userStats[userId].responseCount += 1;
  processedResponsePairs.add(responseKey);
}

function trackVerificationStat(
  userStats: KPIStatMap,
  update: AdminUpdate,
  processedVerifyPairs: Set<string>,
) {
  const userId = update.createdById;
  if (!userId || update.newStatus !== "VERIFIED") return;

  const verifyKey = `verify-${update.workOrderId}`;
  if (processedVerifyPairs.has(verifyKey)) return;

  userStats[userId].verifiedCount += 1;
  if (update.workOrders.completedAt) {
    const verifyMinutes = calculateMinutesBetween(
      new Date(update.workOrders.completedAt),
      new Date(update.createdAt),
    );
    if (verifyMinutes >= 0) {
      userStats[userId].totalVerifyTime += verifyMinutes;
    }
  }

  processedVerifyPairs.add(verifyKey);
}

function trackCompletionStat(userStats: KPIStatMap, update: AdminUpdate) {
  const userId = update.createdById;
  if (!userId) return;
  if (update.newStatus !== "COMPLETED" || !update.user?.role?.isTechnical)
    return;

  userStats[userId].completedCount += 1;
}

async function mergeCanvasingApprovalStats(
  prisma: PrismaClient,
  userStats: KPIStatMap,
  dateFrom: Date,
  dateTo: Date,
) {
  const approvals = await prisma.canvasing.findMany({
    where: {
      approvedAt: { gte: dateFrom, lte: dateTo },
      approvedBy: { not: null },
    },
    select: {
      approvedBy: true,
      approvedAt: true,
      createdAt: true,
    },
  });

  approvals.forEach((approval) => applyCanvasingApproval(userStats, approval));
}

function applyCanvasingApproval(
  userStats: KPIStatMap,
  approval: CanvasingApproval,
) {
  if (!approval.approvedBy || !approval.approvedAt) return;

  const userId = approval.approvedBy;
  const currentStat = userStats[userId]
    ? ensureCanvasingStats(userStats[userId])
    : createFallbackSalesKPIStats();
  const approveTime = calculateMinutesBetween(
    new Date(approval.createdAt),
    new Date(approval.approvedAt),
  );

  if (approveTime < 0) {
    userStats[userId] = currentStat;
    return;
  }

  currentStat.canvasingCount = (currentStat.canvasingCount || 0) + 1;
  currentStat.totalCanvasingTime =
    (currentStat.totalCanvasingTime || 0) + approveTime;
  userStats[userId] = currentStat;
}

async function hydrateUnknownSalesUsers(
  prisma: PrismaClient,
  userStats: KPIStatMap,
) {
  const unknownUserIds = Object.keys(userStats).filter(
    (userId) => userStats[userId]?.name === "Admin (Sales)",
  );
  if (unknownUserIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: unknownUserIds } },
    select: { id: true, name: true, role: { select: { name: true } } },
  });

  users.forEach((user) => {
    const stat = userStats[user.id];
    if (!stat) return;

    stat.name = user.name || "Unknown";
    stat.role = user.role?.name || "N/A";
  });
}
