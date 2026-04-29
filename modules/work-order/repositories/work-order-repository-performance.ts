import { Prisma, type PrismaClient, type WorkOrderType } from "@prisma/client";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type { TopPerformer } from "./IWorkOrderRepository";

/**
 * Get top performers based on completed tasks and average completion time
 */
export async function getTopPerformers(
  prisma: PrismaClient,
  limit: number = 5,
  dateFrom?: Date,
  dateTo?: Date,
  departmentId?: string,
): Promise<TopPerformer[]> {
  const where: Prisma.WorkOrdersWhereInput = {
    status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] },
    assignedToId: { not: null },
    completedAt: { not: null },
    startedAt: { not: null },
  };
  if (departmentId) {
    where.departmentId = departmentId;
  }
  if (dateFrom || dateTo) {
    const completedAtFilter: Prisma.DateTimeNullableFilter = {};
    if (dateFrom) completedAtFilter.gte = dateFrom;
    if (dateTo) completedAtFilter.lte = dateTo;
    where.completedAt = completedAtFilter;
  }
  const completedWorkOrders = await prisma.workOrders.findMany({
    where,
    select: {
      startedAt: true,
      completedAt: true,
      assignedTo: {
        select: {
          name: true,
          role: {
            select: {
              name: true,
            },
          },
          sites: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
  const userStats: Record<
    string,
    { count: number; totalHours: number; role?: string; site?: string }
  > = {};
  completedWorkOrders.forEach((wo) => {
    if (wo.assignedTo && wo.startedAt && wo.completedAt) {
      const name = wo.assignedTo.name || "Unknown";
      const role = wo.assignedTo.role?.name;
      const site = wo.assignedTo.sites?.name;
      const hours =
        (new Date(wo.completedAt).getTime() -
          new Date(wo.startedAt).getTime()) /
        (1000 * 60 * 60);
      if (!userStats[name]) {
        userStats[name] = {
          count: 0,
          totalHours: 0,
          ...(role && { role }),
          ...(site && { site }),
        };
      }
      const currentUserStats = userStats[name];
      if (currentUserStats) {
        currentUserStats.count += 1;
        currentUserStats.totalHours += hours;
      }
    }
  });
  const topPerformers: TopPerformer[] = Object.entries(userStats).map(
    ([name, stats]) => {
      const result: TopPerformer = {
        userName: name,
        count: stats.count,
        avgCompletionTime: stats.totalHours / stats.count,
      };
      if (stats.role) result.role = stats.role;
      if (stats.site) result.site = stats.site;
      return result;
    },
  );
  // Sort by count (desc) then by avgCompletionTime (asc)
  return topPerformers
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.avgCompletionTime - b.avgCompletionTime;
    })
    .slice(0, limit);
}
/**
 * Get top assists - employees who assist as partners the most
 */
export async function getTopAssists(
  prisma: PrismaClient,
  limit: number = 5,
  dateFrom?: Date,
  dateTo?: Date,
  departmentId?: string,
): Promise<TopPerformer[]> {
  const workOrderWhere: Prisma.WorkOrdersWhereInput = {
    status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] },
  };
  if (departmentId) {
    workOrderWhere.departmentId = departmentId;
  }
  if (dateFrom || dateTo) {
    const completedAtFilter: Prisma.DateTimeNullableFilter = {};
    if (dateFrom) completedAtFilter.gte = dateFrom;
    if (dateTo) completedAtFilter.lte = dateTo;
    workOrderWhere.completedAt = completedAtFilter;
  }
  // Find all partner assignments on completed work orders
  const partnerAssignments = await prisma.workOrderAssignments.findMany({
    where: {
      role: "PARTNER",
      status: "APPROVED",
      workOrders: workOrderWhere,
    },
    include: {
      user: {
        select: {
          name: true,
          role: { select: { name: true } },
          sites: { select: { name: true } },
        },
      },
      workOrders: {
        select: {
          startedAt: true,
          completedAt: true,
        },
      },
    },
  });
  const userStats: Record<
    string,
    { count: number; totalHours: number; role?: string; site?: string }
  > = {};
  partnerAssignments.forEach((assignment) => {
    const name = assignment.user?.name || "Unknown";
    const role = assignment.user?.role?.name;
    const site = assignment.user?.sites?.name;
    const wo = assignment.workOrders;
    if (wo.startedAt && wo.completedAt) {
      const hours =
        (new Date(wo.completedAt).getTime() -
          new Date(wo.startedAt).getTime()) /
        (1000 * 60 * 60);
      if (!userStats[name]) {
        userStats[name] = {
          count: 0,
          totalHours: 0,
          ...(role && { role }),
          ...(site && { site }),
        };
      }
      const currentUserStats = userStats[name];
      if (currentUserStats) {
        currentUserStats.count += 1;
        currentUserStats.totalHours += hours;
      }
    }
  });
  const topAssists: TopPerformer[] = Object.entries(userStats).map(
    ([name, stats]) => {
      const result: TopPerformer = {
        userName: name,
        count: stats.count,
        avgCompletionTime: stats.count > 0 ? stats.totalHours / stats.count : 0,
      };
      if (stats.role) result.role = stats.role;
      if (stats.site) result.site = stats.site;
      return result;
    },
  );
  // Sort by count (desc)
  return topAssists.sort((a, b) => b.count - a.count).slice(0, limit);
}
/**
 * Get user work order statistics (count of completed orders)
 */
export async function getUserWorkOrderStats(
  prisma: PrismaClient,
  getTenantIdFromContextFn: typeof getTenantIdFromContext,
  dateFrom: Date,
  dateTo: Date,
  tenantId?: string,
): Promise<Array<{ userId: string; count: number }>> {
  const { tenantId: contextTenantId, isSuperAdmin } =
    await getTenantIdFromContextFn();
  const effectiveTenantId =
    tenantId ??
    (!isSuperAdmin && !contextTenantId
      ? "___MISSING_TENANT_ID___"
      : contextTenantId);
  const where: Record<string, unknown> = {
    status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] },
    assignedToId: { not: null },
    completedAt: {
      gte: dateFrom,
      lte: dateTo,
    },
    ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
  };
  const stats = await prisma.workOrders.groupBy({
    by: ["assignedToId"],
    where,
    _count: {
      _all: true,
    },
  });
  return stats
    .filter((s) => s.assignedToId !== null)
    .map((s) => ({
      userId: s.assignedToId as string,
      count: s._count._all,
    }));
}
/**
 * Get site statistics by work order type
 */
export async function getSiteStatsByType(
  prisma: PrismaClient,
  getTenantIdFromContextFn: typeof getTenantIdFromContext,
  types: WorkOrderType[],
  limit: number,
  dateFrom: Date,
  dateTo: Date,
  tenantId?: string,
): Promise<Array<{ siteId: string; siteName: string; count: number }>> {
  const { tenantId: contextTenantId, isSuperAdmin } =
    await getTenantIdFromContextFn();
  const effectiveTenantId =
    tenantId ??
    (!isSuperAdmin && !contextTenantId
      ? "___MISSING_TENANT_ID___"
      : contextTenantId);
  const where: Record<string, unknown> = {
    type: { in: types },
    status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] },
    siteId: { not: null },
    createdAt: {
      gte: dateFrom,
      lte: dateTo,
    },
    ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
  };
  const stats = await prisma.workOrders.groupBy({
    by: ["siteId"],
    where,
    _count: {
      _all: true,
    },
    orderBy: {
      _count: {
        siteId: "desc", // Note: Prisma aggregation sorting might be limited, handling sort in JS typically safer for complex objects
      },
    },
  });
  // Prisma groupBy doesn't allow automatic relation fetch unlike findMany
  // We need to fetch site names manually or assume stats are small enough
  const siteIds = stats
    .map((s) => s.siteId)
    .filter((id) => id !== null) as string[];
  const sites = await prisma.sites.findMany({
    where: { id: { in: siteIds } },
    select: { id: true, name: true },
  });
  const result = stats
    .map((s) => {
      const site = sites.find((site) => site.id === s.siteId);
      return {
        siteId: s.siteId as string,
        siteName: site?.name || "Unknown",
        count: s._count._all,
      };
    })
    .filter((item) => item.siteId !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  return result;
}
