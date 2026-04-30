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
} from "./IWorkOrderRepository";
import {
  findWorkOrdersByTicketId,
  findWorkOrderWithTicketAndAttachments,
} from "./work-order-repository-attachments";
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
  ): Promise<TopPerformer[]> {
    return getWorkOrderTopPerformers({
      prisma: this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
    });
  }

  async getTopAssists(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
  ): Promise<TopPerformer[]> {
    return getWorkOrderTopAssists({
      prisma: this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
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

  async getDepartmentWorkload(departmentId?: string) {
    return getWorkOrderDepartmentWorkload({
      prisma: this.prisma,
      departmentId,
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
    siteId?: string,
  ) {
    return getWorkOrderIssueStats({
      prisma: this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
      siteId,
    });
  }

  async getSiteStatistics(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getWorkOrderSiteStatistics({
      prisma: this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
      siteId,
    });
  }

  async getDisconnectionStatistics(
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getWorkOrderDisconnectionStatistics({
      prisma: this.prisma,
      dateFrom,
      dateTo,
      departmentId,
      siteId,
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
  ) {
    return getWorkOrderAdminResponseStats({
      prisma: this.prisma,
      dateFrom,
      dateTo,
      departmentId,
    });
  }

  async getAdminKPIStats(departmentId?: string, siteId?: string) {
    return getWorkOrderAdminKpiStats({
      prisma: this.prisma,
      departmentId,
      siteId,
    });
  }

  async getVolumeTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getWorkOrderVolumeTrend({
      prisma: this.prisma,
      startDate,
      endDate,
      departmentId,
      siteId,
    });
  }

  async getIssueTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getWorkOrderIssueTrend({
      prisma: this.prisma,
      startDate,
      endDate,
      departmentId,
      siteId,
    });
  }

  async getPerformanceTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getWorkOrderPerformanceTrend({
      prisma: this.prisma,
      startDate,
      endDate,
      departmentId,
      siteId,
    });
  }

  async getTypeTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getWorkOrderTypeTrend({
      prisma: this.prisma,
      startDate,
      endDate,
      departmentId,
      siteId,
    });
  }
}
