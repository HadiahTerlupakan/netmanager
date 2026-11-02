import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUserProfile: vi.fn(),
  getRecentWorkOrders: vi.fn(),
  getVolumeTrend: vi.fn(),
  getIssueTrend: vi.fn(),
  getPerformanceTrend: vi.fn(),
  getTypeTrend: vi.fn(),
  getDepartmentWorkload: vi.fn(),
}));

vi.mock(
  "@/modules/work-order/repositories/AdminWorkOrderRouteRepository",
  () => ({
    AdminWorkOrderRouteRepository: class {
      findUserProfile = mocks.findUserProfile;
    },
  }),
);
vi.mock("@/modules/work-order/repositories/WorkOrderRepository", () => ({
  WorkOrderRepository: class {
    getVolumeTrend = mocks.getVolumeTrend;
    getIssueTrend = mocks.getIssueTrend;
    getPerformanceTrend = mocks.getPerformanceTrend;
    getTypeTrend = mocks.getTypeTrend;
    getDepartmentWorkload = mocks.getDepartmentWorkload;
  },
}));
vi.mock("@/modules/work-order/services/WorkOrderService", () => ({
  getWorkOrderService: () => ({
    getRecentWorkOrders: mocks.getRecentWorkOrders,
  }),
}));

import { AdminWorkOrderAnalyticsRouteService } from "@/modules/work-order/services/AdminWorkOrderAnalyticsRouteService";
import { AdminWorkOrderRouteService } from "@/modules/work-order/services/AdminWorkOrderRouteService";

const USER = { id: "admin-1", role: "Admin" };
const RANGE = {
  startDate: new Date("2026-10-01T00:00:00Z"),
  endDate: new Date("2026-10-31T00:00:00Z"),
};

function analyticsWith(access: Record<string, unknown>) {
  const repository = {
    getAdminResponseStats: vi.fn().mockResolvedValue([]),
    getTopPerformanceSummary: vi
      .fn()
      .mockResolvedValue({ performers: [], topAssists: [] }),
  };
  const service = new AdminWorkOrderAnalyticsRouteService(
    repository as never,
    vi.fn().mockResolvedValue({ unauthorized: false, ...access }),
  );
  return { service, repository };
}

describe("route analitik work order menegakkan lingkup site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDepartmentWorkload.mockResolvedValue([]);
    mocks.getRecentWorkOrders.mockResolvedValue({ success: true, data: [] });
    for (const trend of [
      mocks.getVolumeTrend,
      mocks.getIssueTrend,
      mocks.getPerformanceTrend,
      mocks.getTypeTrend,
    ]) {
      trend.mockResolvedValue([{ leaked: true }]);
    }
  });

  it("/trends mengembalikan tren kosong untuk role terbatas tanpa site (fail closed)", async () => {
    const { service } = analyticsWith({ emptyResponse: true });

    const result = await service.getTrends({ ...RANGE, user: USER });

    expect(result).toMatchObject({
      success: true,
      data: {
        volumeTrend: [],
        issueTrend: [],
        performanceTrend: [],
        typeTrend: [],
      },
    });
    expect(mocks.getVolumeTrend).not.toHaveBeenCalled();
    expect(mocks.getTypeTrend).not.toHaveBeenCalled();
  });

  it("/trends meneruskan site dan departemen ke setiap query tren", async () => {
    const { service } = analyticsWith({
      emptyResponse: false,
      siteId: "site-1",
      departmentId: "dept-1",
    });

    await service.getTrends({ ...RANGE, user: USER });

    expect(mocks.getVolumeTrend).toHaveBeenCalledWith(
      RANGE.startDate,
      RANGE.endDate,
      "dept-1",
      "site-1",
    );
  });

  it("/response-stats, /top-performers, /department-workload, /recent ikut disaring site", async () => {
    const { service, repository } = analyticsWith({
      emptyResponse: false,
      siteId: "site-1",
    });

    await service.getResponseStats({ user: USER });
    await service.getTopPerformers({ user: USER });
    await service.getDepartmentWorkload({ user: USER });
    await service.getRecentWorkOrders({ user: USER });

    expect(repository.getAdminResponseStats).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
      { departmentId: undefined, siteId: "site-1" },
    );
    expect(repository.getTopPerformanceSummary).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "site-1" }),
    );
    expect(mocks.getDepartmentWorkload).toHaveBeenCalledWith(
      undefined,
      "site-1",
    );
    expect(mocks.getRecentWorkOrders).toHaveBeenCalledWith(5, {
      siteId: "site-1",
    });
  });
});

describe("buildDashboardAccessFilters route analitik membaca permission dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUserProfile.mockResolvedValue({
      id: USER.id,
      role: "Admin",
      departmentId: "dept-1",
      siteId: "site-1",
    });
  });

  it("membatasi site lewat work_order_dashboard:site_only", async () => {
    const filters =
      await new AdminWorkOrderRouteService().buildDashboardAccessFilters(USER, [
        "work_order_dashboard:site_only",
      ]);

    expect(filters).toMatchObject({
      unauthorized: false,
      emptyResponse: false,
      siteId: "site-1",
    });
  });

  it("membatasi departemen lewat work_order_dashboard:department_only", async () => {
    const filters =
      await new AdminWorkOrderRouteService().buildDashboardAccessFilters(USER, [
        "work_order_dashboard:department_only",
      ]);

    expect(filters).toMatchObject({ departmentId: "dept-1" });
  });

  it("tetap menerima workorders:site_only", async () => {
    const filters =
      await new AdminWorkOrderRouteService().buildDashboardAccessFilters(USER, [
        "workorders:site_only",
      ]);

    expect(filters).toMatchObject({ siteId: "site-1" });
  });

  it("gagal tertutup bila role terbatas tanpa site", async () => {
    mocks.findUserProfile.mockResolvedValue({
      id: USER.id,
      role: "Admin",
      departmentId: null,
      siteId: null,
    });

    const filters =
      await new AdminWorkOrderRouteService().buildDashboardAccessFilters(USER, [
        "work_order_dashboard:site_only",
      ]);

    expect(filters).toMatchObject({ emptyResponse: true });
  });

  it("super admin tidak dibatasi", async () => {
    const filters =
      await new AdminWorkOrderRouteService().buildDashboardAccessFilters(
        { ...USER, isSuperAdmin: true },
        ["work_order_dashboard:site_only"],
      );

    expect(filters).toMatchObject({ emptyResponse: false });
    expect(filters).not.toHaveProperty("siteId");
  });
});
