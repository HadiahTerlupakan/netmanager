import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { AdminWorkOrderRouteRepository } from "../repositories/AdminWorkOrderRouteRepository";
import { getWorkOrderService } from "./WorkOrderService";

const DEFAULT_RECENT_LIMIT = 5;
const DEFAULT_TOP_LIMIT = 5;
const LAST_30_DAYS = 30;

type PermissionList = string[] | undefined;

interface DateRange {
  dateFrom?: Date;
  dateTo?: Date;
}

export class AdminWorkOrderAnalyticsRouteService {
  constructor(
    private readonly repository: AdminWorkOrderRouteRepository,
    private readonly buildAccessFilters: (
      user: { id: string; role?: string },
      permissions?: PermissionList,
    ) => Promise<{
      unauthorized: boolean;
      emptyResponse?: boolean;
      departmentId?: string;
      siteId?: string;
    }>,
  ) {}

  private get workOrderService() {
    return getWorkOrderService();
  }

  /** Ambil statistik response stats untuk route admin. */
  async getResponseStats(input: {
    period?: string;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);
    if (access.unauthorized)
      return { success: false as const, code: "UNAUTHORIZED" };
    if (access.emptyResponse) return { success: true as const, data: [] };
    const range = this.buildPeriodRange(input.period || "last_30_days");
    const stats = await this.repository.getAdminResponseStats(
      range.dateFrom,
      range.dateTo,
      access.departmentId,
    );
    return { success: true as const, data: stats };
  }

  /** Ambil recent work orders dengan access filter admin. */
  async getRecentWorkOrders(input: {
    limit?: number;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);
    if (access.unauthorized)
      return { success: false as const, code: "UNAUTHORIZED" };
    if (access.emptyResponse) return { success: true as const, data: [] };
    return this.workOrderService.getRecentWorkOrders(
      input.limit || DEFAULT_RECENT_LIMIT,
      { ...(access.departmentId ? { departmentId: access.departmentId } : {}) },
    );
  }

  /** Ambil workload departemen dengan filtering akses admin. */
  async getDepartmentWorkload(input: {
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);
    if (access.unauthorized)
      return { success: false as const, code: "UNAUTHORIZED" };
    if (access.emptyResponse) return { success: true as const, data: [] };
    const dynamicImport = await import("../repositories/WorkOrderRepository");
    const repository = new dynamicImport.WorkOrderRepository();
    const data = await repository.getDepartmentWorkload(access.departmentId);
    return { success: true as const, data };
  }

  /** Ambil statistik overview dengan filtering akses admin. */
  async getStats(input: {
    filters: { departmentId?: string; assignedToId?: string };
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);
    if (access.unauthorized)
      return { success: false as const, code: "UNAUTHORIZED" };
    const filters = { ...input.filters };
    if (access.emptyResponse)
      return { success: true as const, data: this.getEmptyStats() };
    if (access.departmentId) filters.departmentId = access.departmentId;
    if (access.siteId) Object.assign(filters, { siteId: access.siteId });
    return this.workOrderService.getStatistics(filters);
  }

  /** Ambil summary top performer sesuai periode. */
  async getTopPerformers(input: {
    period?: string;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);
    if (access.unauthorized)
      return { success: false as const, code: "UNAUTHORIZED" };
    if (access.emptyResponse) {
      return {
        success: true as const,
        data: { performers: [], topAssists: [] },
      };
    }
    const range = this.buildPeriodRange(input.period || "all_time");
    const data = await this.repository.getTopPerformanceSummary({
      limit: DEFAULT_TOP_LIMIT,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      departmentId: access.departmentId,
    });
    return { success: true as const, data };
  }

  /** Ambil data analytics trend dengan access filter admin. */
  async getTrends(input: {
    startDate: Date;
    endDate: Date;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);
    if (access.unauthorized)
      return { success: false as const, code: "UNAUTHORIZED" };
    const dynamicImport = await import("../repositories/WorkOrderRepository");
    const repository = new dynamicImport.WorkOrderRepository();
    const departmentId = access.emptyResponse ? undefined : access.departmentId;
    const siteId = access.emptyResponse ? undefined : access.siteId;
    const [volumeTrend, issueTrend, performanceTrend, typeTrend] =
      await Promise.all([
        repository.getVolumeTrend(
          input.startDate,
          input.endDate,
          departmentId,
          siteId,
        ),
        repository.getIssueTrend(
          input.startDate,
          input.endDate,
          departmentId,
          siteId,
        ),
        repository.getPerformanceTrend(
          input.startDate,
          input.endDate,
          departmentId,
          siteId,
        ),
        repository.getTypeTrend(
          input.startDate,
          input.endDate,
          departmentId,
          siteId,
        ),
      ]);
    return {
      success: true as const,
      data: {
        volumeTrend,
        issueTrend,
        performanceTrend,
        typeTrend,
        dateRange: {
          startDate: input.startDate.toISOString(),
          endDate: input.endDate.toISOString(),
        },
      },
    };
  }

  private buildPeriodRange(period: string): Required<DateRange> {
    const now = new Date();
    if (period === "daily") {
      return {
        dateFrom: new Date(toStartOfDay(now)),
        dateTo: new Date(toEndOfDay(now)),
      };
    }
    if (period === "weekly") {
      const firstDay = new Date(now);
      firstDay.setDate(now.getDate() - now.getDay());
      return { dateFrom: new Date(toStartOfDay(firstDay)), dateTo: new Date() };
    }
    if (period === "monthly") {
      return {
        dateFrom: new Date(now.getFullYear(), now.getMonth(), 1),
        dateTo: new Date(),
      };
    }
    if (period === "yearly") {
      return {
        dateFrom: new Date(now.getFullYear(), 0, 1),
        dateTo: new Date(),
      };
    }
    if (period === "all_time")
      return { dateFrom: new Date(0), dateTo: new Date() };
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - LAST_30_DAYS);
    return { dateFrom, dateTo: new Date() };
  }

  private getEmptyStats() {
    return {
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
    };
  }
}
