import {
  Prisma,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@prisma/client";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type {
  WorkOrderFilters,
  WorkOrderStatistics,
} from "../domain/ports/IWorkOrderRepository";

const CLOSED_STATUSES: WorkOrderStatus[] = [
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
  "CANCELLED",
];
const HIGH_PRIORITY_LEVELS: WorkOrderPriority[] = [
  "HIGH",
  "URGENT",
  "CRITICAL",
];
const EMPTY_TENANT_ID = "___MISSING_TENANT_ID___";

interface StatisticsQueryContext {
  where: Prisma.WorkOrdersWhereInput;
  completionQuery: Prisma.Sql;
}

interface StatisticsAggregateRow {
  avgHours: number;
  totalCost: number;
}

interface StatisticsRepositoryClient {
  workOrders: typeof import("@/lib/prisma").prisma.workOrders;
  $queryRaw: typeof import("@/lib/prisma").prisma.$queryRaw;
}

/** Ambil statistik inti work order dengan query agregasi yang konsisten. */
export async function getWorkOrderStatisticsCore(input: {
  prisma: StatisticsRepositoryClient;
  filters?: Omit<WorkOrderFilters, "search">;
  tenantId?: string;
}): Promise<WorkOrderStatistics> {
  const queryContext = await buildStatisticsQueryContext(
    input.filters,
    input.tenantId,
  );
  const [total, statusCounts, completionStats, ratingData, urgentOpen] =
    await Promise.all(createStatisticsQueries(input.prisma, queryContext));
  return mapStatisticsResult({
    total,
    statusCounts,
    completionStats: completionStats[0] || { avgHours: 0, totalCost: 0 },
    ratingData,
    urgentOpen,
  });
}

function createStatisticsQueries(
  prisma: StatisticsRepositoryClient,
  queryContext: StatisticsQueryContext,
) {
  return [
    prisma.workOrders.count({ where: queryContext.where }),
    prisma.workOrders.groupBy({
      by: ["status"],
      where: queryContext.where,
      _count: true,
    }),
    prisma.$queryRaw<StatisticsAggregateRow[]>(queryContext.completionQuery),
    prisma.workOrders.aggregate({
      where: { ...queryContext.where, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.workOrders.count({
      where: buildUrgentOpenWhere(queryContext.where),
    }),
  ] as const;
}

function buildUrgentOpenWhere(where: Prisma.WorkOrdersWhereInput) {
  return {
    ...where,
    priority: { in: HIGH_PRIORITY_LEVELS },
    status: { notIn: CLOSED_STATUSES },
  };
}

async function buildStatisticsQueryContext(
  filters?: Omit<WorkOrderFilters, "search">,
  tenantId?: string,
): Promise<StatisticsQueryContext> {
  const where = buildStatisticsWhere(filters);
  const effectiveTenantId = await resolveEffectiveTenantId(tenantId);
  if (effectiveTenantId) {
    where.tenantId = effectiveTenantId;
  }
  return {
    where,
    completionQuery: buildCompletionStatisticsQuery(filters, effectiveTenantId),
  };
}

function buildStatisticsWhere(
  filters?: Omit<WorkOrderFilters, "search">,
): Prisma.WorkOrdersWhereInput {
  const where: Prisma.WorkOrdersWhereInput = {};
  if (filters?.siteId) where.siteId = filters.siteId;
  if (filters?.departmentId) where.departmentId = filters.departmentId;
  if (filters?.assignedToId !== undefined)
    where.assignedToId = filters.assignedToId;
  if (filters?.pelangganId) where.pelangganId = filters.pelangganId;
  if (!filters?.dateFrom && !filters?.dateTo) {
    return where;
  }
  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.dateFrom) createdAt.gte = filters.dateFrom;
  if (filters.dateTo) createdAt.lte = filters.dateTo;
  where.createdAt = createdAt;
  return where;
}

async function resolveEffectiveTenantId(
  tenantId?: string,
): Promise<string | undefined> {
  const context = await getTenantIdFromContext();
  if (tenantId) {
    return tenantId;
  }
  if (context.isSuperAdmin) {
    return context.tenantId ?? undefined;
  }
  return context.tenantId ?? EMPTY_TENANT_ID;
}

function buildCompletionStatisticsQuery(
  filters?: Omit<WorkOrderFilters, "search">,
  tenantId?: string,
): Prisma.Sql {
  let query = Prisma.sql`
    SELECT
      AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 3600)::float as "avgHours",
      SUM("actualCost")::float as "totalCost"
    FROM "work_orders"
    WHERE "completedAt" IS NOT NULL
      AND "startedAt" IS NOT NULL
  `;
  if (tenantId) query = Prisma.sql`${query} AND "tenantId" = ${tenantId}`;
  if (filters?.siteId)
    query = Prisma.sql`${query} AND "siteId" = ${filters.siteId}`;
  if (filters?.departmentId) {
    query = Prisma.sql`${query} AND "departmentId" = ${filters.departmentId}`;
  }
  if (filters?.assignedToId) {
    query = Prisma.sql`${query} AND "assignedToId" = ${filters.assignedToId}`;
  }
  if (filters?.pelangganId) {
    query = Prisma.sql`${query} AND "pelangganId" = ${filters.pelangganId}`;
  }
  if (filters?.dateFrom) {
    query = Prisma.sql`${query} AND "createdAt" >= ${filters.dateFrom}`;
  }
  if (filters?.dateTo) {
    query = Prisma.sql`${query} AND "createdAt" <= ${filters.dateTo}`;
  }
  return query;
}

function mapStatisticsResult(input: {
  total: number;
  statusCounts: Array<{ status: string; _count: number }>;
  completionStats: StatisticsAggregateRow;
  ratingData: { _avg: { rating: number | null }; _count: { rating: number } };
  urgentOpen: number;
}): WorkOrderStatistics {
  const statusMap = input.statusCounts.reduce<Record<string, number>>(
    (accumulator, item) => {
      accumulator[item.status] = item._count;
      return accumulator;
    },
    {},
  );
  return {
    total: input.total,
    pending: statusMap.PENDING || 0,
    assigned: statusMap.ASSIGNED || 0,
    inProgress: statusMap.IN_PROGRESS || 0,
    onHold: statusMap.ON_HOLD || 0,
    completed: statusMap.COMPLETED || 0,
    verified: statusMap.VERIFIED || 0,
    closed: statusMap.CLOSED || 0,
    cancelled: statusMap.CANCELLED || 0,
    urgentOpen: input.urgentOpen,
    avgCompletionTimeHours: input.completionStats.avgHours || 0,
    totalCost: input.completionStats.totalCost || 0,
    avgRating: input.ratingData._avg.rating || null,
    totalWithRating: input.ratingData._count.rating || 0,
  };
}
