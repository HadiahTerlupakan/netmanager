import type { MikroTikRouterStatistics } from "@/modules/network";

export type DashboardTenantInput = {
  tenantId: string;
};

export type DashboardLimitInput = {
  tenantId: string;
  limit?: number;
};

export type DailyAttendanceStat = {
  present?: number;
  late?: number;
  absent?: number;
};

export type AttendanceUserStat = {
  userId: string | null;
  _count: {
    _all: number;
  };
};

export type WorkOrderStats = {
  pending?: number;
  inProgress?: number;
  completed?: number;
  verified?: number;
  closed?: number;
};

export type WorkOrderUserStat = {
  userId: string | null;
  count: number;
};

export type SiteStat = {
  siteId: string;
  siteName: string;
  count: number;
};

export type InventorySummary = {
  total: number;
};

export type MarketingSummary = {
  totalPoints: number;
  pendingClaims: number;
  approvedClaims: number;
};

export type DashboardUserDetails = {
  id: string;
  name: string | null;
  image: string | null;
  role?: {
    name: string;
  } | null;
  sites: {
    name: string;
  } | null;
  departments: {
    name: string;
  } | null;
};

export interface IAttendanceDashboardRepository {
  /** Get daily attendance statistics for a tenant. */
  getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ): Promise<DailyAttendanceStat[]>;

  /** Get grouped attendance counts per user. */
  getUserAttendanceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ): Promise<AttendanceUserStat[]>;
}

export interface IWorkOrderDashboardRepository {
  /** Get aggregate work order statistics. */
  getStatistics(
    filters: { dateFrom?: Date; dateTo?: Date },
    tenantId?: string,
  ): Promise<WorkOrderStats>;

  /** Get grouped work order counts per user. */
  getUserWorkOrderStats(
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<WorkOrderUserStat[]>;

  /** Get site statistics for the given work order types. */
  getSiteStatsByType(
    workOrderTypes: string[],
    limit: number,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<SiteStat[]>;
}

export interface IInventoryDashboardRepository {
  /** Get inventory summary for dashboard. */
  findAllBarang(input: {
    take?: number;
    tenantId?: string;
  }): Promise<InventorySummary>;
}

export interface IUserDashboardRepository {
  /** Get user details for leaderboard rendering. */
  findManyWithFullDetails(
    userIds: string[],
    tenantId?: string,
  ): Promise<DashboardUserDetails[]>;
}

export interface IPointClaimDashboardService {
  /** Get marketing claim summary for dashboard. */
  getDashboardSummary(tenantId?: string): Promise<MarketingSummary>;
}

export interface IMikroTikStatisticsRepository {
  /** Get MikroTik router statistics for dashboard. */
  getStatistics(
    tenantId: string,
    siteId?: string,
  ): Promise<MikroTikRouterStatistics>;
}
