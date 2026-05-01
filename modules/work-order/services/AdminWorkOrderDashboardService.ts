import { ApiErrors, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { AdminWorkOrderRouteRepository } from "../repositories/AdminWorkOrderRouteRepository";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import {
  buildAnalyticsDateRange,
  buildDashboardDateRange,
  buildWorkOrderDashboardAccessFilters,
  getEmptyWorkOrderDashboardData,
} from "./admin-work-order-dashboard.helpers";
import { workOrderCacheService } from "./WorkOrderCacheService";

const RECENT_WORK_ORDER_LIMIT = 5;
const ANALYTICS_LIMIT = 5;
const FALLBACK_RESPONSE_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type DashboardAccess = {
  departmentId?: string;
  siteId?: string;
  emptyResponse: boolean;
};

type DashboardCacheOptions = {
  departmentId?: string;
  siteId?: string;
};

export interface AdminWorkOrderUserContext {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
}

export interface AdminWorkOrderDashboardOptions {
  user: AdminWorkOrderUserContext;
  permissions?: string[];
  period?: string;
}

export class AdminWorkOrderDashboardService {
  private readonly routeRepository: AdminWorkOrderRouteRepository;

  constructor(
    workOrderRepo?: WorkOrderRepository,
    routeRepository?: AdminWorkOrderRouteRepository,
  ) {
    this.workOrderRepo = workOrderRepo ?? new WorkOrderRepository(prisma);
    this.routeRepository =
      routeRepository ?? new AdminWorkOrderRouteRepository();
  }

  /** Ambil ringkasan dashboard work order admin. */
  async getDashboardData(
    options: AdminWorkOrderDashboardOptions,
  ): Promise<NextResponse> {
    const profile = await this.routeRepository.findUserProfile(options.user.id);
    if (!profile) return ApiErrors.unauthorized();

    const access = this.resolveAccess(options, profile);
    if (access.emptyResponse) {
      return apiSuccess({
        ...getEmptyWorkOrderDashboardData(),
        message: "Restricted access: No department/site assigned.",
      });
    }

    const period = options.period ?? "all_time";
    const cacheOptions = this.createCacheOptions(access);
    const cached = await workOrderCacheService.getCachedDashboardData(
      options.user.id,
      period,
      cacheOptions,
    );
    if (cached) {
      return apiSuccess({
        ...(cached as Record<string, unknown>),
        cached: true,
      });
    }

    const dateRange = buildDashboardDateRange(period);
    const statistics = await this.loadDashboardStatistics(access, dateRange);
    const typeStats =
      await this.routeRepository.countWorkOrderTypes(cacheOptions);
    const dashboardData = {
      ...statistics,
      woTypeStats: typeStats,
    };

    await workOrderCacheService.cacheDashboardData(
      options.user.id,
      period,
      dashboardData,
      cacheOptions,
    );

    return apiSuccess({ ...dashboardData, cached: false });
  }

  /** Ambil data analitik dashboard work order admin. */
  async getAnalyticsData(
    options: AdminWorkOrderDashboardOptions,
  ): Promise<NextResponse> {
    const profile = await this.routeRepository.findUserProfile(options.user.id);
    if (!profile) return ApiErrors.unauthorized();

    const access = this.resolveAccess(options, profile);
    if (access.emptyResponse) {
      return apiSuccess({
        issues: [],
        sites: [],
        disconnections: [],
        message: this.getRestrictedMessage(access),
      });
    }

    const { dateFrom, dateTo } = buildAnalyticsDateRange(
      options.period ?? "all_time",
    );
    const [issueStats, siteStats, disconnectionStats] = await Promise.all([
      this.workOrderRepo.getIssueStatistics(
        ANALYTICS_LIMIT,
        dateFrom,
        dateTo,
        access.departmentId,
        access.siteId,
      ),
      this.workOrderRepo.getSiteStatistics(
        ANALYTICS_LIMIT,
        dateFrom,
        dateTo,
        access.departmentId,
        access.siteId,
      ),
      this.workOrderRepo.getDisconnectionStatistics(
        dateFrom,
        dateTo,
        access.departmentId,
        access.siteId,
      ),
    ]);

    return apiSuccess({
      issues: issueStats,
      sites: siteStats,
      disconnections: disconnectionStats,
    });
  }

  private resolveAccess(
    options: AdminWorkOrderDashboardOptions,
    profile: NonNullable<
      Awaited<ReturnType<AdminWorkOrderRouteRepository["findUserProfile"]>>
    >,
  ): DashboardAccess {
    return buildWorkOrderDashboardAccessFilters({
      role: options.user.role,
      isSuperAdmin: options.user.isSuperAdmin,
      permissions: options.permissions ?? [],
      departmentId: profile.departmentId,
      siteId: profile.siteId,
    });
  }

  private createCacheOptions(access: DashboardAccess): DashboardCacheOptions {
    return {
      ...(access.departmentId ? { departmentId: access.departmentId } : {}),
      ...(access.siteId ? { siteId: access.siteId } : {}),
    };
  }

  private async loadDashboardStatistics(
    access: DashboardAccess,
    dateRange: ReturnType<typeof buildDashboardDateRange>,
  ) {
    const responseRange = this.createResponseRange(dateRange);
    return Promise.all([
      this.workOrderRepo.getStatistics(this.createCacheOptions(access)),
      this.workOrderRepo.getRecentWorkOrders(
        RECENT_WORK_ORDER_LIMIT,
        this.createCacheOptions(access),
      ),
      this.workOrderRepo.getDepartmentWorkload(access.departmentId),
      this.workOrderRepo.getTopPerformers(
        ANALYTICS_LIMIT,
        dateRange.dateFrom,
        dateRange.dateTo,
        access.departmentId,
      ),
      this.workOrderRepo.getTopAssists(
        ANALYTICS_LIMIT,
        dateRange.dateFrom,
        dateRange.dateTo,
        access.departmentId,
      ),
      this.workOrderRepo.getIssueStatistics(
        ANALYTICS_LIMIT,
        dateRange.dateFrom,
        dateRange.dateTo,
        access.departmentId,
        access.siteId,
      ),
      this.workOrderRepo.getSiteStatistics(
        ANALYTICS_LIMIT,
        dateRange.dateFrom,
        dateRange.dateTo,
        access.departmentId,
        access.siteId,
      ),
      this.workOrderRepo.getDisconnectionStatistics(
        dateRange.dateFrom,
        dateRange.dateTo,
        access.departmentId,
        access.siteId,
      ),
      this.workOrderRepo.getAdminResponseStats(
        responseRange.dateFrom,
        responseRange.dateTo,
        access.departmentId,
      ),
      this.workOrderRepo.getAdminKPIStats(access.departmentId, access.siteId),
    ]).then(
      ([
        stats,
        recentWorkOrders,
        departmentWorkload,
        topPerformers,
        topAssists,
        issueStats,
        siteStats,
        disconnectionStats,
        responseStats,
        adminKPI,
      ]) => ({
        stats,
        recentWorkOrders,
        departmentWorkload,
        topPerformers,
        topAssists,
        issueStats,
        siteStats,
        disconnectionStats,
        responseStats,
        adminKPI,
      }),
    );
  }

  private createResponseRange(
    dateRange: ReturnType<typeof buildDashboardDateRange>,
  ) {
    return {
      dateFrom:
        dateRange.dateFrom ??
        new Date(Date.now() - FALLBACK_RESPONSE_DAYS * DAY_IN_MS),
      dateTo: dateRange.dateTo ?? new Date(),
    };
  }

  private getRestrictedMessage(access: DashboardAccess) {
    if (access.siteId === undefined) {
      return "Restricted access: No site assigned.";
    }

    if (access.departmentId === undefined) {
      return "Restricted access: No department assigned.";
    }

    return "Restricted access: No department/site assigned.";
  }
}

let adminWorkOrderDashboardServiceInstance: AdminWorkOrderDashboardService | null =
  null;

/** Return the shared admin work-order dashboard service lazily. */
export function getAdminWorkOrderDashboardService() {
  adminWorkOrderDashboardServiceInstance ??=
    new AdminWorkOrderDashboardService();
  return adminWorkOrderDashboardServiceInstance;
}
