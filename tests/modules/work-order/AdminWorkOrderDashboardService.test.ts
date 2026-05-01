import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  userFindUnique: vi.fn(),
  getCachedDashboardData: vi.fn(),
  cacheDashboardData: vi.fn(),
  getStatistics: vi.fn(),
  getRecentWorkOrders: vi.fn(),
  getDepartmentWorkload: vi.fn(),
  getTopPerformers: vi.fn(),
  getTopAssists: vi.fn(),
  getIssueStatistics: vi.fn(),
  getSiteStatistics: vi.fn(),
  getDisconnectionStatistics: vi.fn(),
  getAdminResponseStats: vi.fn(),
  getAdminKPIStats: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFns.userFindUnique,
    },
    workOrders: {
      count: mockFns.count,
    },
  },
}));

vi.mock("@/modules/work-order/repositories/WorkOrderRepository", () => ({
  WorkOrderRepository: class MockWorkOrderRepository {
    getStatistics = mockFns.getStatistics;
    getRecentWorkOrders = mockFns.getRecentWorkOrders;
    getDepartmentWorkload = mockFns.getDepartmentWorkload;
    getTopPerformers = mockFns.getTopPerformers;
    getTopAssists = mockFns.getTopAssists;
    getIssueStatistics = mockFns.getIssueStatistics;
    getSiteStatistics = mockFns.getSiteStatistics;
    getDisconnectionStatistics = mockFns.getDisconnectionStatistics;
    getAdminResponseStats = mockFns.getAdminResponseStats;
    getAdminKPIStats = mockFns.getAdminKPIStats;
  },
}));

vi.mock("@/modules/work-order/services/WorkOrderCacheService", () => ({
  workOrderCacheService: {
    getCachedDashboardData: mockFns.getCachedDashboardData,
    cacheDashboardData: mockFns.cacheDashboardData,
  },
}));

import { AdminWorkOrderDashboardService } from "@/modules/work-order/services/AdminWorkOrderDashboardService";

describe("AdminWorkOrderDashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.userFindUnique.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      departmentId: "dept-1",
      siteId: "site-1",
    });
    mockFns.count.mockResolvedValue(0);
    mockFns.getCachedDashboardData.mockResolvedValue(null);
    mockFns.getStatistics.mockResolvedValue({ total: 0 });
    mockFns.getRecentWorkOrders.mockResolvedValue([]);
    mockFns.getDepartmentWorkload.mockResolvedValue([]);
    mockFns.getTopPerformers.mockResolvedValue([]);
    mockFns.getTopAssists.mockResolvedValue([]);
    mockFns.getIssueStatistics.mockResolvedValue([]);
    mockFns.getSiteStatistics.mockResolvedValue([]);
    mockFns.getDisconnectionStatistics.mockResolvedValue([]);
    mockFns.getAdminResponseStats.mockResolvedValue([]);
    mockFns.getAdminKPIStats.mockResolvedValue({
      pendingVerification: 0,
      avgVerificationTimeMinutes: 0,
      avgCanvasingTimeMinutes: 0,
      canvasingApprovedToday: 0,
      canvasingApprovedThisWeek: 0,
    });
  });

  it("returns an empty restricted dashboard when department access is required but no department is assigned", async () => {
    mockFns.userFindUnique.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      departmentId: null,
      siteId: "site-1",
    });

    const service = new AdminWorkOrderDashboardService();
    const result = await service.getDashboardData({
      user: { id: "user-1", role: "ADMIN" },
      permissions: ["workorders:department_only"],
      period: "all_time",
    });

    expect(result.status).toBe(200);
    const body = (await result.json()) as {
      success: boolean;
      data: {
        message?: string;
        cached?: boolean;
        recentWorkOrders?: unknown[];
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.message).toBe("Restricted access: No site assigned.");
    expect(body.data.cached).toBeUndefined();
    expect(body.data.recentWorkOrders).toEqual([]);
    expect(mockFns.getCachedDashboardData).not.toHaveBeenCalled();
    expect(mockFns.getStatistics).not.toHaveBeenCalled();
  });

  it("returns cached dashboard data when a cache hit is available", async () => {
    mockFns.getCachedDashboardData.mockResolvedValue({ stats: { total: 7 } });

    const service = new AdminWorkOrderDashboardService();
    const result = await service.getDashboardData({
      user: { id: "user-1", role: "ADMIN" },
      permissions: [],
      period: "monthly",
    });

    expect(result.status).toBe(200);
    const body = (await result.json()) as {
      success: boolean;
      data: { cached?: boolean; stats?: { total: number } };
    };

    expect(body.success).toBe(true);
    expect(body.data.cached).toBe(true);
    expect(body.data.stats).toEqual({ total: 7 });
    expect(mockFns.getStatistics).not.toHaveBeenCalled();
  });

  it("applies both department and site filters to recent work orders when restricted", async () => {
    const service = new AdminWorkOrderDashboardService();

    await service.getDashboardData({
      user: { id: "user-1", role: "ADMIN" },
      permissions: ["workorders:department_only", "workorders:site_only"],
      period: "monthly",
    });

    expect(mockFns.getRecentWorkOrders).toHaveBeenCalledWith(5, {
      departmentId: "dept-1",
      siteId: "site-1",
    });
  });

  it("returns an empty restricted analytics payload when site access is required but no site is assigned", async () => {
    mockFns.userFindUnique.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      departmentId: "dept-1",
      siteId: null,
    });

    const service = new AdminWorkOrderDashboardService();
    const result = await service.getAnalyticsData({
      user: { id: "user-1", role: "ADMIN" },
      permissions: ["workorders:site_only"],
      period: "yearly",
    });

    expect(result.status).toBe(200);
    const body = (await result.json()) as {
      success: boolean;
      data: {
        message?: string;
        issues?: unknown[];
        sites?: unknown[];
        disconnections?: unknown[];
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.message).toBe("Restricted access: No site assigned.");
    expect(body.data.issues).toEqual([]);
    expect(body.data.sites).toEqual([]);
    expect(body.data.disconnections).toEqual([]);
    expect(mockFns.getIssueStatistics).not.toHaveBeenCalled();
    expect(mockFns.getSiteStatistics).not.toHaveBeenCalled();
    expect(mockFns.getDisconnectionStatistics).not.toHaveBeenCalled();
  });
});
