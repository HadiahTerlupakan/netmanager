import type { WorkOrderType } from "@prisma/client";

import { getTenantIdFromContext } from "@/lib/tenant-context";
import type {
  IssueStatistic,
  TopPerformer,
  WorkOrderFilters,
  WorkOrderStatistics,
  WorkOrderWithRelations,
} from "../domain/ports/IWorkOrderRepository";
import { getWorkOrderStatisticsCore } from "./work-order-repository-statistics-core";
import {
  getAdminKPIStats,
  getAdminResponseStats,
  getIssueTrend,
  getPerformanceTrend,
  getTypeTrend,
  getVolumeTrend,
} from "./work-order-repository-analytics";
import {
  getDisconnectionStatistics,
  getIssueStatistics,
  getSiteStatistics,
} from "./work-order-repository-statistics";
import {
  getDepartmentWorkload,
  getEmployeeDepartmentWorkOrders,
  getRecentWorkOrders,
} from "./work-order-repository-dashboard";
import {
  getSiteStatsByType,
  getTopAssists,
  getTopPerformers,
  getUserWorkOrderStats,
} from "./work-order-repository-performance";

type PrismaInstance = typeof import("@/lib/prisma").prisma;

export function getWorkOrderStatisticsReport(input: {
  prisma: PrismaInstance;
  filters?: Omit<WorkOrderFilters, "search">;
  tenantId?: string;
}): Promise<WorkOrderStatistics> {
  return getWorkOrderStatisticsCore(input);
}

export function getWorkOrderTopPerformers(input: {
  prisma: PrismaInstance;
  limit: number;
  dateFrom?: Date;
  dateTo?: Date;
  departmentId?: string;
}): Promise<TopPerformer[]> {
  return getTopPerformers(
    input.prisma,
    input.limit,
    input.dateFrom,
    input.dateTo,
    input.departmentId,
  );
}

export function getWorkOrderTopAssists(input: {
  prisma: PrismaInstance;
  limit: number;
  dateFrom?: Date;
  dateTo?: Date;
  departmentId?: string;
}): Promise<TopPerformer[]> {
  return getTopAssists(
    input.prisma,
    input.limit,
    input.dateFrom,
    input.dateTo,
    input.departmentId,
  );
}

export function getWorkOrderUserStats(input: {
  prisma: PrismaInstance;
  dateFrom: Date;
  dateTo: Date;
  tenantId?: string;
}): Promise<Array<{ userId: string; count: number }>> {
  return getUserWorkOrderStats(
    input.prisma,
    getTenantIdFromContext,
    input.dateFrom,
    input.dateTo,
    input.tenantId,
  );
}

export function getWorkOrderSiteStatsByType(input: {
  prisma: PrismaInstance;
  types: WorkOrderType[];
  limit: number;
  dateFrom: Date;
  dateTo: Date;
  tenantId?: string;
}): Promise<Array<{ siteId: string; siteName: string; count: number }>> {
  return getSiteStatsByType(
    input.prisma,
    getTenantIdFromContext,
    input.types,
    input.limit,
    input.dateFrom,
    input.dateTo,
    input.tenantId,
  );
}

export function getWorkOrderRecentItems(input: {
  prisma: PrismaInstance;
  limit: number;
  filters?: WorkOrderFilters;
}): Promise<WorkOrderWithRelations[]> {
  return getRecentWorkOrders(input.prisma, input.limit, input.filters);
}

export function getWorkOrderDepartmentWorkload(input: {
  prisma: PrismaInstance;
  departmentId?: string;
}) {
  return getDepartmentWorkload(input.prisma, input.departmentId);
}

export function getEmployeeWorkOrdersByDepartment(input: {
  prisma: PrismaInstance;
  departmentId: string;
  employeeId: string;
  filters?: WorkOrderFilters;
  page: number;
  limit: number;
}) {
  return getEmployeeDepartmentWorkOrders(
    input.prisma,
    input.departmentId,
    input.employeeId,
    input.filters,
    input.page,
    input.limit,
  );
}

export function getWorkOrderIssueStats(input: {
  prisma: PrismaInstance;
  limit: number;
  dateFrom?: Date;
  dateTo?: Date;
  departmentId?: string;
  siteId?: string;
}): Promise<IssueStatistic[]> {
  return getIssueStatistics(
    input.prisma,
    input.limit,
    input.dateFrom,
    input.dateTo,
    input.departmentId,
    input.siteId,
  );
}

export function getWorkOrderSiteStatistics(input: {
  prisma: PrismaInstance;
  limit: number;
  dateFrom?: Date;
  dateTo?: Date;
  departmentId?: string;
  siteId?: string;
}) {
  return getSiteStatistics(
    input.prisma,
    input.limit,
    input.dateFrom,
    input.dateTo,
    input.departmentId,
    input.siteId,
  );
}

export function getWorkOrderDisconnectionStatistics(input: {
  prisma: PrismaInstance;
  dateFrom?: Date;
  dateTo?: Date;
  departmentId?: string;
  siteId?: string;
}) {
  return getDisconnectionStatistics(
    input.prisma,
    input.dateFrom,
    input.dateTo,
    input.departmentId,
    input.siteId,
  );
}

export function getWorkOrderAdminResponseStats(input: {
  prisma: PrismaInstance;
  dateFrom: Date;
  dateTo: Date;
  departmentId?: string;
}) {
  return getAdminResponseStats(
    input.prisma,
    input.dateFrom,
    input.dateTo,
    input.departmentId,
  );
}

export function getWorkOrderAdminKpiStats(input: {
  prisma: PrismaInstance;
  departmentId?: string;
  siteId?: string;
}) {
  return getAdminKPIStats(input.prisma, input.departmentId, input.siteId);
}

export function getWorkOrderVolumeTrend(input: {
  prisma: PrismaInstance;
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  siteId?: string;
}) {
  return getVolumeTrend(
    input.prisma,
    input.startDate,
    input.endDate,
    input.departmentId,
    input.siteId,
  );
}

export function getWorkOrderIssueTrend(input: {
  prisma: PrismaInstance;
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  siteId?: string;
}) {
  return getIssueTrend(
    input.prisma,
    input.startDate,
    input.endDate,
    input.departmentId,
    input.siteId,
  );
}

export function getWorkOrderPerformanceTrend(input: {
  prisma: PrismaInstance;
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  siteId?: string;
}) {
  return getPerformanceTrend(
    input.prisma,
    input.startDate,
    input.endDate,
    input.departmentId,
    input.siteId,
  );
}

export function getWorkOrderTypeTrend(input: {
  prisma: PrismaInstance;
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  siteId?: string;
}) {
  return getTypeTrend(
    input.prisma,
    input.startDate,
    input.endDate,
    input.departmentId,
    input.siteId,
  );
}
