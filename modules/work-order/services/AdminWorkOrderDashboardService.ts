import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiErrors, apiSuccess } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { workOrderCacheService } from "./WorkOrderCacheService";

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
  private readonly workOrderRepo = new WorkOrderRepository(prisma);

  async getDashboardData(
    options: AdminWorkOrderDashboardOptions,
  ): Promise<NextResponse> {
    const { user, permissions = [], period = "all_time" } = options;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, departmentId: true, siteId: true },
    });

    if (!dbUser) return ApiErrors.unauthorized();

    const { departmentId, siteId, emptyResponse } = this.buildAccessFilters({
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      permissions,
      departmentId: dbUser.departmentId,
      siteId: dbUser.siteId,
    });

    if (emptyResponse) {
      return apiSuccess({
        ...this.getEmptyDashboardData(),
        message: "Restricted access: No department/site assigned.",
      });
    }

    const cacheOptions = {
      ...(departmentId ? { departmentId } : {}),
      ...(siteId ? { siteId } : {}),
    };

    const cachedData = await workOrderCacheService.getCachedDashboardData(
      user.id,
      period,
      cacheOptions,
    );
    if (cachedData) {
      return apiSuccess({
        ...(cachedData as Record<string, unknown>),
        cached: true,
      });
    }

    const { dateFrom, dateTo } = this.buildDashboardDateRange(period);

    const [
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
    ] = await Promise.all([
      this.workOrderRepo.getStatistics({
        ...(departmentId ? { departmentId } : {}),
        ...(siteId ? { siteId } : {}),
      }),
      this.workOrderRepo.getRecentWorkOrders(5, {
        ...(departmentId ? { departmentId } : {}),
        ...(siteId ? { siteId } : {}),
      }),
      this.workOrderRepo.getDepartmentWorkload(departmentId),
      this.workOrderRepo.getTopPerformers(5, dateFrom, dateTo, departmentId),
      this.workOrderRepo.getTopAssists(5, dateFrom, dateTo, departmentId),
      this.workOrderRepo.getIssueStatistics(
        5,
        dateFrom,
        dateTo,
        departmentId,
        siteId,
      ),
      this.workOrderRepo.getSiteStatistics(
        5,
        dateFrom,
        dateTo,
        departmentId,
        siteId,
      ),
      this.workOrderRepo.getDisconnectionStatistics(
        dateFrom,
        dateTo,
        departmentId,
        siteId,
      ),
      this.workOrderRepo.getAdminResponseStats(
        dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dateTo || new Date(),
        departmentId,
      ),
      this.workOrderRepo.getAdminKPIStats(departmentId, siteId),
    ]);

    const baseWhere = {
      ...(departmentId ? { departmentId } : {}),
      ...(siteId ? { siteId } : {}),
    };

    const [customerCount, internalCount] = await Promise.all([
      prisma.workOrders.count({
        where: {
          ...baseWhere,
          isInternal: false,
        },
      }),
      prisma.workOrders.count({
        where: {
          ...baseWhere,
          isInternal: true,
        },
      }),
    ]);

    const dashboardData = {
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
      woTypeStats: {
        customer: customerCount,
        internal: internalCount,
      },
    };

    await workOrderCacheService.cacheDashboardData(
      user.id,
      period,
      dashboardData,
      cacheOptions,
    );

    return apiSuccess({
      ...dashboardData,
      cached: false,
    });
  }

  async getAnalyticsData(
    options: AdminWorkOrderDashboardOptions,
  ): Promise<NextResponse> {
    const { user, permissions = [], period = "all_time" } = options;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, departmentId: true, siteId: true },
    });

    if (!dbUser) return ApiErrors.unauthorized();

    const { dateFrom, dateTo } = this.buildAnalyticsDateRange(period);
    const isSuper = isSuperAdmin({
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    });

    const hasDepartmentRestriction = permissions.includes(
      "workorders:department_only",
    );
    if (hasDepartmentRestriction && !isSuper && !dbUser.departmentId) {
      return apiSuccess({
        issues: [],
        sites: [],
        disconnections: [],
        message: "Restricted access: No department assigned.",
      });
    }

    const hasSiteRestriction = permissions.includes("workorders:site_only");
    if (hasSiteRestriction && !isSuper && !dbUser.siteId) {
      return apiSuccess({
        issues: [],
        sites: [],
        disconnections: [],
        message: "Restricted access: No site assigned.",
      });
    }

    const departmentIdFilter =
      hasDepartmentRestriction && !isSuper
        ? dbUser.departmentId || undefined
        : undefined;
    const siteIdFilter =
      hasSiteRestriction && !isSuper ? dbUser.siteId || undefined : undefined;

    const [issueStats, siteStats, disconnectionStats] = await Promise.all([
      this.workOrderRepo.getIssueStatistics(
        5,
        dateFrom,
        dateTo,
        departmentIdFilter,
        siteIdFilter,
      ),
      this.workOrderRepo.getSiteStatistics(
        5,
        dateFrom,
        dateTo,
        departmentIdFilter,
        siteIdFilter,
      ),
      this.workOrderRepo.getDisconnectionStatistics(
        dateFrom,
        dateTo,
        departmentIdFilter,
        siteIdFilter,
      ),
    ]);

    return apiSuccess({
      issues: issueStats,
      sites: siteStats,
      disconnections: disconnectionStats,
    });
  }

  private buildDashboardDateRange(period: string): {
    dateFrom?: Date;
    dateTo?: Date;
  } {
    const now = new Date();
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined = new Date();

    switch (period) {
      case "daily":
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly": {
        const firstDay = now.getDate() - now.getDay();
        dateFrom = new Date(now.getFullYear(), now.getMonth(), firstDay);
        break;
      }
      case "monthly":
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "yearly":
        dateFrom = new Date(now.getFullYear(), 0, 1);
        break;
      case "last_30_days":
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "all_time":
      default:
        dateFrom = undefined;
        dateTo = undefined;
        break;
    }

    return {
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    };
  }

  private buildAnalyticsDateRange(period: string): {
    dateFrom?: Date;
    dateTo?: Date;
  } {
    const now = new Date();
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (period === "daily") {
      dateFrom = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );
      dateTo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );
    } else if (period === "weekly") {
      const firstDay = now.getDate() - now.getDay();
      dateFrom = new Date(now.getFullYear(), now.getMonth(), firstDay);
      dateTo = new Date();
    } else if (period === "monthly") {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      dateTo = new Date();
    } else if (period === "yearly") {
      dateFrom = new Date(now.getFullYear(), 0, 1);
      dateTo = new Date();
    }

    return {
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    };
  }

  private buildAccessFilters(options: {
    role?: string;
    isSuperAdmin?: boolean;
    permissions?: string[];
    departmentId?: string | null;
    siteId?: string | null;
  }): {
    departmentId?: string;
    siteId?: string;
    emptyResponse: boolean;
  } {
    const hasDepartmentRestriction = options.permissions?.includes(
      "workorders:department_only",
    );
    const hasSiteRestriction = options.permissions?.includes(
      "workorders:site_only",
    );
    const isSuper = isSuperAdmin({
      role: options.role,
      isSuperAdmin: options.isSuperAdmin,
    });

    let departmentId: string | undefined;
    let siteId: string | undefined;
    let emptyResponse = false;

    if (hasDepartmentRestriction && !isSuper) {
      if (!options.departmentId) {
        emptyResponse = true;
      } else {
        departmentId = options.departmentId;
      }
    }

    if (hasSiteRestriction && !isSuper) {
      if (!options.siteId) {
        emptyResponse = true;
      } else {
        siteId = options.siteId;
      }
    }

    return {
      ...(departmentId ? { departmentId } : {}),
      ...(siteId ? { siteId } : {}),
      emptyResponse,
    };
  }

  private getEmptyDashboardData() {
    return {
      stats: {
        total: 0,
        pending: 0,
        assigned: 0,
        inProgress: 0,
        onHold: 0,
        completed: 0,
        verified: 0,
        closed: 0,
        cancelled: 0,
        urgentOpen: 0,
        avgCompletionTimeHours: 0,
        totalCost: 0,
        avgRating: null as number | null,
        totalWithRating: 0,
      },
      recentWorkOrders: [] as unknown[],
      departmentWorkload: [] as unknown[],
      topPerformers: [] as unknown[],
      topAssists: [] as unknown[],
      issueStats: [] as unknown[],
      siteStats: [] as unknown[],
      disconnectionStats: [] as unknown[],
      responseStats: [] as unknown[],
      adminKPI: {
        pendingVerification: 0,
        avgVerificationTimeMinutes: 0,
        avgOnHoldResponseMinutes: 0,
        verifiedToday: 0,
        verifiedThisWeek: 0,
      },
      woTypeStats: {
        customer: 0,
        internal: 0,
      },
    };
  }
}

export const adminWorkOrderDashboardService =
  new AdminWorkOrderDashboardService();
