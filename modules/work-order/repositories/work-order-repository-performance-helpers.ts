import { Prisma, type WorkOrderType } from "@prisma/client";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type { TopPerformer } from "./IWorkOrderRepository";

const COMPLETED_WORK_ORDER_STATUSES = [
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
] as const;
const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
const MISSING_TENANT_ID = "___MISSING_TENANT_ID___";

type PerformerAggregate = {
  count: number;
  totalHours: number;
  role?: string;
  site?: string;
};

type CompletionWindow = {
  dateFrom?: Date;
  dateTo?: Date;
  departmentId?: string;
};

/** Build completed work order filter for performer queries. */
export function buildCompletedWorkOrderWhere(
  params: CompletionWindow,
): Prisma.WorkOrdersWhereInput {
  const where: Prisma.WorkOrdersWhereInput = {
    status: { in: [...COMPLETED_WORK_ORDER_STATUSES] },
  };

  if (params.departmentId) {
    where.departmentId = params.departmentId;
  }

  if (params.dateFrom || params.dateTo) {
    where.completedAt = buildCompletedAtFilter(params.dateFrom, params.dateTo);
  }

  return where;
}

/** Build stricter completed work order filter for lead performer query. */
export function buildLeadPerformerWhere(
  params: CompletionWindow,
): Prisma.WorkOrdersWhereInput {
  return {
    ...buildCompletedWorkOrderWhere(params),
    assignedToId: { not: null as string | null },
    completedAt: {
      not: null as Date | null,
      ...buildCompletedAtFilter(params.dateFrom, params.dateTo),
    },
    startedAt: { not: null },
  };
}

/** Convert date pair into Prisma completedAt filter. */
export function buildCompletedAtFilter(
  dateFrom?: Date,
  dateTo?: Date,
): Prisma.DateTimeNullableFilter {
  const filter: Prisma.DateTimeNullableFilter = {};

  if (dateFrom) filter.gte = dateFrom;
  if (dateTo) filter.lte = dateTo;

  return filter;
}

/** Aggregate performer statistics by user name. */
export function accumulatePerformerStats(
  currentStats: Record<string, PerformerAggregate>,
  params: {
    userName?: string | null;
    role?: string | null;
    site?: string | null;
    startedAt: Date;
    completedAt: Date;
  },
): Record<string, PerformerAggregate> {
  const userName = params.userName || "Unknown";
  const performerStats =
    currentStats[userName] ?? createEmptyPerformerAggregate();

  performerStats.count += 1;
  performerStats.totalHours += calculateDurationHours(
    params.startedAt,
    params.completedAt,
  );

  if (params.role) performerStats.role = params.role;
  if (params.site) performerStats.site = params.site;

  currentStats[userName] = performerStats;
  return currentStats;
}

/** Map performer aggregate into DTO list. */
export function mapTopPerformers(
  statsByUser: Record<string, PerformerAggregate>,
): TopPerformer[] {
  return Object.entries(statsByUser).map(([userName, stats]) => ({
    userName,
    count: stats.count,
    avgCompletionTime: stats.count > 0 ? stats.totalHours / stats.count : 0,
    ...(stats.role ? { role: stats.role } : {}),
    ...(stats.site ? { site: stats.site } : {}),
  }));
}

/** Sort top performers by output count and speed. */
export function sortTopPerformers(items: TopPerformer[]): TopPerformer[] {
  return items.sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.avgCompletionTime - right.avgCompletionTime;
  });
}

/** Sort top assists by count only. */
export function sortTopAssists(items: TopPerformer[]): TopPerformer[] {
  return items.sort((left, right) => right.count - left.count);
}

/** Resolve effective tenant identifier for cross-tenant-safe performance queries. */
export async function resolveEffectiveTenantId(
  getTenantIdFromContextFn: typeof getTenantIdFromContext,
  tenantId?: string,
): Promise<string | undefined> {
  const { tenantId: contextTenantId, isSuperAdmin } =
    await getTenantIdFromContextFn();

  return (
    tenantId ??
    (!isSuperAdmin && !contextTenantId ? MISSING_TENANT_ID : contextTenantId)
  );
}

/** Build site statistics where filter by work order type. */
export function buildSiteStatsWhere(params: {
  types: WorkOrderType[];
  dateFrom: Date;
  dateTo: Date;
  tenantId?: string;
}): Prisma.WorkOrdersWhereInput {
  return {
    type: { in: params.types },
    status: { in: [...COMPLETED_WORK_ORDER_STATUSES] },
    siteId: { not: null as string | null },
    createdAt: {
      gte: params.dateFrom,
      lte: params.dateTo,
    },
    ...(params.tenantId ? { tenantId: params.tenantId } : {}),
  };
}

/** Merge grouped site counts with site names. */
export function mapSiteStatsByType(params: {
  stats: Array<{ siteId: string | null; _count: { _all: number } }>;
  sites: Array<{ id: string; name: string }>;
  limit: number;
}) {
  return params.stats
    .map((stat) => ({
      siteId: stat.siteId as string,
      siteName:
        params.sites.find((site) => site.id === stat.siteId)?.name || "Unknown",
      count: stat._count._all,
    }))
    .filter((item) => item.siteId !== null)
    .sort((left, right) => right.count - left.count)
    .slice(0, params.limit);
}

function calculateDurationHours(startedAt: Date, completedAt: Date) {
  return (completedAt.getTime() - startedAt.getTime()) / MILLISECONDS_PER_HOUR;
}

function createEmptyPerformerAggregate(): PerformerAggregate {
  return {
    count: 0,
    totalHours: 0,
  };
}
