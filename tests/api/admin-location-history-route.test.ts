import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  getLocationHistory: vi.fn().mockResolvedValue([]),
  getLocationStats: vi.fn().mockResolvedValue({
    totalPoints: 0,
    firstLocation: null,
    lastLocation: null,
    totalDistance: 0,
  }),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  ApiErrors: {
    forbidden: (message: string) =>
      NextResponse.json({ error: message }, { status: 403 }),
    unauthorized: () =>
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  },
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/attendance", () => ({
  LocationTrackingService: class MockLocationTrackingService {
    getLocationHistory = mockFns.getLocationHistory;
    getLocationStats = mockFns.getLocationStats;
  },
}));

describe("admin location history route", () => {
  let getLocationHistoryRoute: (typeof import("@/app/api/admin/location/history/[userId]/route"))["GET"];

  beforeAll(async () => {
    ({ GET: getLocationHistoryRoute } =
      await import("@/app/api/admin/location/history/[userId]/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.getLocationHistory.mockResolvedValue([]);
    mockFns.getLocationStats.mockResolvedValue({
      totalPoints: 0,
      firstLocation: null,
      lastLocation: null,
      totalDistance: 0,
    });
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: "admin-1",
        siteId: "site-a",
        departmentId: "dept-a",
      })
      .mockResolvedValueOnce({
        id: "user-1",
        siteId: "site-a",
        departmentId: "dept-a",
      });
  });

  it("passes the requested date range into location stats calculation", async () => {
    const response = await getLocationHistoryRoute(
      new NextRequest(
        "http://localhost/api/admin/location/history/user-1?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-03T23:59:59.999Z",
      ),
      {
        params: { userId: "user-1" },
        session: { user: { id: "admin-1", tenantId: "tenant-1" } },
        permissions: [],
      } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.getLocationStats).toHaveBeenCalledWith(
      "user-1",
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-04-03T23:59:59.999Z"),
    );
  });

  it("rejects history access outside the admin site scope", async () => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: "admin-1",
        siteId: "site-a",
        departmentId: null,
      })
      .mockResolvedValueOnce({
        id: "user-2",
        siteId: "site-b",
        departmentId: null,
      });

    const response = await getLocationHistoryRoute(
      new NextRequest("http://localhost/api/admin/location/history/user-2"),
      {
        params: { userId: "user-2" },
        session: { user: { id: "admin-1", tenantId: "tenant-1" } },
        permissions: ["live_tracking:site_only"],
      } as never,
    );

    expect(response.status).toBe(403);
    expect(mockFns.getLocationHistory).not.toHaveBeenCalled();
    expect(mockFns.getLocationStats).not.toHaveBeenCalled();
  });
});
