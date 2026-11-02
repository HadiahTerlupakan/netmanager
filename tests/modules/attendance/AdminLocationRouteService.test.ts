import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  findById: vi.fn(),
  getLiveLocations: vi.fn(),
  getLocationHistory: vi.fn(),
  getLocationStats: vi.fn(),
  resolveAdminScope: vi.fn(),
  getUserPermissions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock(
  "@/modules/attendance/services/AdminScopeResolver",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/attendance/services/AdminScopeResolver")
    >()),
    resolveAdminScope: mockFns.resolveAdminScope,
  }),
);

vi.mock("@/modules/attendance/services/LocationTrackingService", () => ({
  LocationTrackingService: class {
    getLiveLocations = mockFns.getLiveLocations;
    getLocationHistory = mockFns.getLocationHistory;
    getLocationStats = mockFns.getLocationStats;
  },
}));

vi.mock("@/modules/users", () => ({
  UserLookupService: class {
    findById = mockFns.findById;
    findAccessAssignmentById = async (id: string) => {
      const user = await mockFns.findById(id);
      if (!user) return null;
      return {
        siteIds: user.siteIds ?? (user.siteId ? [user.siteId] : []),
        departmentId: user.departmentId ?? null,
      };
    };
  },
}));

import {
  AdminLocationRouteError,
  AdminLocationRouteService,
} from "@/modules/attendance/services/AdminLocationRouteService";

describe("AdminLocationRouteService history access", () => {
  const service = new AdminLocationRouteService();

  beforeEach(async () => {
    vi.clearAllMocks();
    // History memakai resolver lingkup yang SAMA dengan live list; izin
    // dibaca lewat getUserPermissions, bukan dari input route.
    const actual = await vi.importActual<
      typeof import("@/modules/attendance/services/AdminScopeResolver")
    >("@/modules/attendance/services/AdminScopeResolver");
    mockFns.resolveAdminScope.mockImplementation(actual.resolveAdminScope);
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getLocationHistory.mockResolvedValue([]);
    mockFns.getLocationStats.mockResolvedValue({
      totalPoints: 0,
      firstLocation: null,
      lastLocation: null,
      totalDistance: 0,
    });
  });

  it("forbids cross-site history when admin has live_tracking:site_only", async () => {
    mockFns.findById.mockImplementation(async (id: string) => {
      if (id === "admin-1") {
        return {
          id: "admin-1",
          siteId: "site-a",
          departmentId: "dept-1",
          tenantId: "tenant-1",
        };
      }
      return {
        id: "user-2",
        siteId: "site-b",
        departmentId: "dept-1",
        tenantId: "tenant-1",
      };
    });

    mockFns.getUserPermissions.mockResolvedValue([
      "live_tracking:read",
      "live_tracking:site_only",
    ]);
    await expect(
      service.getLocationHistory({
        userId: "user-2",
        session: {
          user: { id: "admin-1", tenantId: "tenant-1" },
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows same-site history when admin has live_tracking:site_only", async () => {
    mockFns.findById.mockImplementation(async (id: string) => {
      if (id === "admin-1") {
        return {
          id: "admin-1",
          siteId: "site-a",
          departmentId: "dept-1",
          tenantId: "tenant-1",
        };
      }
      return {
        id: "user-2",
        siteId: "site-a",
        departmentId: "dept-2",
        tenantId: "tenant-1",
      };
    });

    mockFns.getUserPermissions.mockResolvedValue([
      "live_tracking:read",
      "live_tracking:site_only",
    ]);
    await expect(
      service.getLocationHistory({
        userId: "user-2",
        session: {
          user: { id: "admin-1", tenantId: "tenant-1" },
        },
      }),
    ).resolves.toMatchObject({ userId: "user-2" });
  });

  // Regresi multi-site: dulu hanya site utama admin yang dibandingkan.
  it("allows history of a user in the admin's second site", async () => {
    mockFns.findById.mockImplementation(async (id: string) => {
      if (id === "admin-1") {
        return {
          id: "admin-1",
          siteId: "site-a",
          siteIds: ["site-a", "site-b"],
          departmentId: "dept-1",
          tenantId: "tenant-1",
        };
      }
      return {
        id: "user-2",
        siteId: "site-b",
        departmentId: "dept-1",
        tenantId: "tenant-1",
      };
    });

    mockFns.getUserPermissions.mockResolvedValue([
      "live_tracking:read",
      "live_tracking:site_only",
    ]);
    await expect(
      service.getLocationHistory({
        userId: "user-2",
        session: {
          user: { id: "admin-1", tenantId: "tenant-1" },
        },
      }),
    ).resolves.toMatchObject({ userId: "user-2" });
  });

  it("forbids cross-tenant history even without site_only", async () => {
    mockFns.findById.mockImplementation(async (id: string) => {
      if (id === "admin-1") {
        return {
          id: "admin-1",
          siteId: "site-a",
          departmentId: "dept-1",
          tenantId: "tenant-1",
        };
      }
      return {
        id: "user-2",
        siteId: "site-a",
        departmentId: "dept-1",
        tenantId: "tenant-2",
      };
    });

    mockFns.getUserPermissions.mockResolvedValue(["live_tracking:read"]);
    await expect(
      service.getLocationHistory({
        userId: "user-2",
        session: {
          user: { id: "admin-1", tenantId: "tenant-1" },
        },
      }),
    ).rejects.toBeInstanceOf(AdminLocationRouteError);
  });

  it("allows superadmin any target", async () => {
    mockFns.isSuperAdmin.mockReturnValue(true);

    mockFns.getUserPermissions.mockResolvedValue([]);
    await expect(
      service.getLocationHistory({
        userId: "user-any",
        session: {
          user: { id: "sa-1", tenantId: null },
        },
      }),
    ).resolves.toMatchObject({ userId: "user-any" });
    expect(mockFns.findById).not.toHaveBeenCalled();
  });

  // Regresi: history dulu merakit lingkupnya sendiri dari izin route;
  // sekarang satu jalur dengan live list (resolveAdminScope).
  function adminDanTarget(
    admin: Record<string, unknown>,
    target: Record<string, unknown>,
  ) {
    mockFns.findById.mockImplementation(async (id: string) =>
      id === "admin-1"
        ? { id: "admin-1", tenantId: "tenant-1", ...admin }
        : { id: "user-2", tenantId: "tenant-1", ...target },
    );
  }

  const inputHistory = {
    userId: "user-2",
    session: { user: { id: "admin-1", tenantId: "tenant-1" } },
  };

  it("menolak history bila admin site_only tidak punya site sama sekali", async () => {
    adminDanTarget({ siteId: null }, { siteId: "site-a" });
    mockFns.getUserPermissions.mockResolvedValue(["live_tracking:site_only"]);

    await expect(
      service.getLocationHistory(inputHistory),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("menolak history target di departemen lain untuk department_only", async () => {
    adminDanTarget(
      { siteId: "site-a", departmentId: "dept-1" },
      { siteId: "site-a", departmentId: "dept-2" },
    );
    mockFns.getUserPermissions.mockResolvedValue([
      "live_tracking:department_only",
    ]);

    await expect(
      service.getLocationHistory(inputHistory),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("menolak history bila admin department_only tidak punya departemen", async () => {
    adminDanTarget(
      { siteId: "site-a", departmentId: null },
      { siteId: "site-a", departmentId: null },
    );
    mockFns.getUserPermissions.mockResolvedValue([
      "live_tracking:department_only",
    ]);

    await expect(
      service.getLocationHistory(inputHistory),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("role wildcard '*' tidak dianggap terbatas", async () => {
    adminDanTarget({ siteId: "site-a" }, { siteId: "site-z" });
    mockFns.getUserPermissions.mockResolvedValue(["*"]);

    await expect(
      service.getLocationHistory(inputHistory),
    ).resolves.toMatchObject({ userId: "user-2" });
  });

  it("memakai lingkup yang sama dengan live list", async () => {
    adminDanTarget({ siteId: "site-a" }, { siteId: "site-b" });
    mockFns.resolveAdminScope.mockResolvedValue({
      isSuperAdmin: false,
      lingkupSite: { dibatasi: true, siteIds: ["site-a"] },
      tanpaSite: false,
      tanpaDepartemen: false,
    });

    await expect(
      service.getLocationHistory(inputHistory),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockFns.resolveAdminScope).toHaveBeenCalledWith(
      inputHistory.session.user,
      {
        siteOnly: "live_tracking:site_only",
        departmentOnly: "live_tracking:department_only",
      },
      expect.anything(),
    );
  });
});

describe("AdminLocationRouteService live scope", () => {
  const service = new AdminLocationRouteService();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getLiveLocations.mockResolvedValue([]);
  });

  it("filters live locations to ALL of the admin's sites", async () => {
    mockFns.resolveAdminScope.mockResolvedValue({
      isSuperAdmin: false,
      lingkupSite: { dibatasi: true, siteIds: ["site-a", "site-b"] },
      tanpaSite: false,
      tanpaDepartemen: false,
    });

    await service.getLiveLocations({
      user: { id: "admin-1", tenantId: "tenant-1" },
    });

    expect(mockFns.getLiveLocations).toHaveBeenCalledWith({
      siteId: { in: ["site-a", "site-b"] },
    });
  });

  it("returns nothing when restricted without any site", async () => {
    mockFns.resolveAdminScope.mockResolvedValue({
      isSuperAdmin: false,
      lingkupSite: { dibatasi: true, siteIds: [] },
      tanpaSite: true,
      tanpaDepartemen: false,
    });

    const result = await service.getLiveLocations({
      user: { id: "admin-1", tenantId: "tenant-1" },
    });

    expect(result.locations).toEqual([]);
    expect(mockFns.getLiveLocations).not.toHaveBeenCalled();
  });
});
