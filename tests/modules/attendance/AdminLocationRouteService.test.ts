import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  findById: vi.fn(),
  getLiveLocations: vi.fn(),
  getLocationHistory: vi.fn(),
  getLocationStats: vi.fn(),
  resolveAdminScope: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/modules/attendance/services/AdminScopeResolver", () => ({
  resolveAdminScope: mockFns.resolveAdminScope,
}));

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
  },
}));

import {
  AdminLocationRouteError,
  AdminLocationRouteService,
} from "@/modules/attendance/services/AdminLocationRouteService";

describe("AdminLocationRouteService history access", () => {
  const service = new AdminLocationRouteService();

  beforeEach(() => {
    vi.clearAllMocks();
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

    await expect(
      service.getLocationHistory({
        userId: "user-2",
        permissions: ["live_tracking:read", "live_tracking:site_only"],
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

    await expect(
      service.getLocationHistory({
        userId: "user-2",
        permissions: ["live_tracking:read", "live_tracking:site_only"],
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

    await expect(
      service.getLocationHistory({
        userId: "user-2",
        permissions: ["live_tracking:read"],
        session: {
          user: { id: "admin-1", tenantId: "tenant-1" },
        },
      }),
    ).rejects.toBeInstanceOf(AdminLocationRouteError);
  });

  it("allows superadmin any target", async () => {
    mockFns.isSuperAdmin.mockReturnValue(true);

    await expect(
      service.getLocationHistory({
        userId: "user-any",
        permissions: [],
        session: {
          user: { id: "sa-1", tenantId: null },
        },
      }),
    ).resolves.toMatchObject({ userId: "user-any" });
    expect(mockFns.findById).not.toHaveBeenCalled();
  });
});
