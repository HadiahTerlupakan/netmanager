import { type PrismaClient, type WorkOrderType } from "@prisma/client";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type { TopPerformer } from "../domain/ports/IWorkOrderRepository";
import {
  accumulatePerformerStats,
  buildCompletedWorkOrderWhere,
  buildLeadPerformerWhere,
  buildSiteStatsWhere,
  mapSiteStatsByType,
  mapTopPerformers,
  resolveEffectiveTenantId,
  sortTopAssists,
  sortTopPerformers,
} from "./work-order-repository-performance-helpers";

/** Get top performers based on completed tasks and average completion time. */
export async function getTopPerformers(
  prisma: PrismaClient,
  limit: number = 5,
  dateFrom?: Date,
  dateTo?: Date,
  departmentId?: string,
): Promise<TopPerformer[]> {
  const completedWorkOrders = await prisma.workOrders.findMany({
    where: buildLeadPerformerWhere({ dateFrom, dateTo, departmentId }),
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

  const statsByUser = completedWorkOrders.reduce<
    Record<
      string,
      {
        count: number;
        totalHours: number;
        role?: string;
        site?: string;
      }
    >
  >((aggregates, workOrder) => {
    if (
      !workOrder.assignedTo ||
      !workOrder.startedAt ||
      !workOrder.completedAt
    ) {
      return aggregates;
    }

    return accumulatePerformerStats(aggregates, {
      userName: workOrder.assignedTo.name,
      role: workOrder.assignedTo.role?.name,
      site: workOrder.assignedTo.sites?.name,
      startedAt: workOrder.startedAt,
      completedAt: workOrder.completedAt,
    });
  }, {});

  return sortTopPerformers(mapTopPerformers(statsByUser)).slice(0, limit);
}

/** Get top assists for approved partner assignments. */
export async function getTopAssists(
  prisma: PrismaClient,
  limit: number = 5,
  dateFrom?: Date,
  dateTo?: Date,
  departmentId?: string,
): Promise<TopPerformer[]> {
  const partnerAssignments = await prisma.workOrderAssignments.findMany({
    where: {
      role: "PARTNER",
      status: "APPROVED",
      workOrders: buildCompletedWorkOrderWhere({
        dateFrom,
        dateTo,
        departmentId,
      }),
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

  const statsByUser = partnerAssignments.reduce<
    Record<
      string,
      {
        count: number;
        totalHours: number;
        role?: string;
        site?: string;
      }
    >
  >((aggregates, assignment) => {
    const workOrder = assignment.workOrders;
    if (!workOrder.startedAt || !workOrder.completedAt) {
      return aggregates;
    }

    return accumulatePerformerStats(aggregates, {
      userName: assignment.user?.name,
      role: assignment.user?.role?.name,
      site: assignment.user?.sites?.name,
      startedAt: workOrder.startedAt,
      completedAt: workOrder.completedAt,
    });
  }, {});

  return sortTopAssists(mapTopPerformers(statsByUser)).slice(0, limit);
}

/** Get user work order completion statistics. */
export async function getUserWorkOrderStats(
  prisma: PrismaClient,
  getTenantIdFromContextFn: typeof getTenantIdFromContext,
  dateFrom: Date,
  dateTo: Date,
  tenantId?: string,
): Promise<Array<{ userId: string; count: number }>> {
  const effectiveTenantId = await resolveEffectiveTenantId(
    getTenantIdFromContextFn,
    tenantId,
  );
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
    .filter((item) => item.assignedToId !== null)
    .map((item) => ({
      userId: item.assignedToId as string,
      count: item._count._all,
    }));
}

/** Get site statistics aggregated by work order type. */
export async function getSiteStatsByType(
  prisma: PrismaClient,
  getTenantIdFromContextFn: typeof getTenantIdFromContext,
  types: WorkOrderType[],
  limit: number,
  dateFrom: Date,
  dateTo: Date,
  tenantId?: string,
): Promise<Array<{ siteId: string; siteName: string; count: number }>> {
  const effectiveTenantId = await resolveEffectiveTenantId(
    getTenantIdFromContextFn,
    tenantId,
  );
  const where = buildSiteStatsWhere({
    types,
    dateFrom,
    dateTo,
    tenantId: effectiveTenantId,
  });

  const stats = await prisma.workOrders.groupBy({
    by: ["siteId"],
    where,
    _count: {
      _all: true,
    },
    orderBy: {
      _count: {
        siteId: "desc",
      },
    },
  });

  const siteIds = stats
    .map((item) => item.siteId)
    .filter((siteId) => siteId !== null) as string[];
  const sites = await prisma.sites.findMany({
    where: { id: { in: siteIds } },
    select: { id: true, name: true },
  });

  return mapSiteStatsByType({ stats, sites, limit });
}
