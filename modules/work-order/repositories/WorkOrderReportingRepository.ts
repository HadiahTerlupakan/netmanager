import type {
  WorkOrders,
  WorkOrderAttachments,
  WorkOrderType,
} from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/prisma";
import type {
  WorkOrderFilters,
  WorkOrderStatistics,
  TopPerformer,
  WorkOrderWithRelations,
} from "../domain/ports/IWorkOrderRepository";
import {
  findWorkOrdersByTicketId,
  findWorkOrderWithTicketAndAttachments,
} from "./work-order-repository-attachments";
import type { WorkOrderSiteScope } from "./work-order-site-scope";
import {
  getEmployeeWorkOrdersByDepartment,
  getWorkOrderAdminKpiStats,
  getWorkOrderAdminResponseStats,
  getWorkOrderDepartmentWorkload,
  getWorkOrderDisconnectionStatistics,
  getWorkOrderIssueStats,
  getWorkOrderIssueTrend,
  getWorkOrderPerformanceTrend,
  getWorkOrderRecentItems,
  getWorkOrderSiteStatistics,
  getWorkOrderSiteStatsByType,
  getWorkOrderStatisticsReport,
  getWorkOrderTopAssists,
  getWorkOrderTopPerformers,
  getWorkOrderTypeTrend,
  getWorkOrderUserStats,
  getWorkOrderVolumeTrend,
} from "./work-order-repository-reporting";

type PrismaInstance = typeof defaultPrisma;

export class WorkOrderReportingRepository {
  constructor(protected readonly prisma: PrismaInstance = defaultPrisma) {}

  async getStatistics(
    filters?: Omit<WorkOrderFilters, "search">,
    tenantId?: string,
  ): Promise<WorkOrderStatistics> {
    return getWorkOrderStatisticsReport({
      prisma: this.prisma,
      filters,
      tenantId,
    });
  }

  async getTopPerformers(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ): Promise<TopPerformer[]> {
    return getWorkOrderTopPerformers({
      prisma: this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
      siteIds,
    });
  }

  async getTopAssists(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ): Promise<TopPerformer[]> {
    return getWorkOrderTopAssists({
      prisma: this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
      siteIds,
    });
  }

  async getUserWorkOrderStats(dateFrom: Date, dateTo: Date, tenantId?: string) {
    return getWorkOrderUserStats({
      prisma: this.prisma,
      dateFrom,
      dateTo,
      tenantId,
    });
  }

  async getSiteStatsByType(
    types: WorkOrderType[],
    limit: number,
    dateFrom: Date,
    dateTo: Date,
    tenantId?: string,
  ) {
    return getWorkOrderSiteStatsByType({
      prisma: this.prisma,
      types,
      limit,
      dateFrom,
      dateTo,
      tenantId,
    });
  }

  async getRecentWorkOrders(
    limit: number = 5,
    filters?: WorkOrderFilters,
  ): Promise<WorkOrderWithRelations[]> {
    return getWorkOrderRecentItems({ prisma: this.prisma, limit, filters });
  }

  async getDepartmentWorkload(
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ) {
    return getWorkOrderDepartmentWorkload({
      prisma: this.prisma,
      departmentId,
      siteIds,
    });
  }

  async getEmployeeDepartmentWorkOrders(
    departmentId: string,
    employeeId: string,
    filters?: WorkOrderFilters,
    page: number = 1,
    limit: number = 20,
  ) {
    return getEmployeeWorkOrdersByDepartment({
      prisma: this.prisma,
      departmentId,
      employeeId,
      filters,
      page,
      limit,
    });
  }

  async getIssueStatistics(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ) {
    return getWorkOrderIssueStats({
      prisma: this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
      siteIds,
    });
  }

  async getSiteStatistics(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ) {
    return getWorkOrderSiteStatistics({
      prisma: this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
      siteIds,
    });
  }

  async getDisconnectionStatistics(
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ) {
    return getWorkOrderDisconnectionStatistics({
      prisma: this.prisma,
      dateFrom,
      dateTo,
      departmentId,
      siteIds,
    });
  }

  async findByIdWithTicketAndAttachments(id: string): Promise<
    | (WorkOrders & {
        ticket: import("@prisma/client").SupportTickets | null;
        attachments: WorkOrderAttachments[];
      })
    | null
  > {
    return findWorkOrderWithTicketAndAttachments({ prisma: this.prisma, id });
  }

  async findManyByTicketId(ticketId: string): Promise<WorkOrders[]> {
    return findWorkOrdersByTicketId({ prisma: this.prisma, ticketId });
  }

  async getAdminResponseStats(
    dateFrom: Date,
    dateTo: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ) {
    return getWorkOrderAdminResponseStats({
      prisma: this.prisma,
      dateFrom,
      dateTo,
      departmentId,
      siteIds,
    });
  }

  async getAdminKPIStats(departmentId?: string, siteIds?: WorkOrderSiteScope) {
    return getWorkOrderAdminKpiStats({
      prisma: this.prisma,
      departmentId,
      siteIds,
    });
  }

  async getVolumeTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ) {
    return getWorkOrderVolumeTrend({
      prisma: this.prisma,
      startDate,
      endDate,
      departmentId,
      siteIds,
    });
  }

  async getIssueTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ) {
    return getWorkOrderIssueTrend({
      prisma: this.prisma,
      startDate,
      endDate,
      departmentId,
      siteIds,
    });
  }

  async getPerformanceTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ) {
    return getWorkOrderPerformanceTrend({
      prisma: this.prisma,
      startDate,
      endDate,
      departmentId,
      siteIds,
    });
  }

  async getTypeTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteIds?: WorkOrderSiteScope,
  ) {
    return getWorkOrderTypeTrend({
      prisma: this.prisma,
      startDate,
      endDate,
      departmentId,
      siteIds,
    });
  }
}
