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
    badRequest: (message: string) =>
      NextResponse.json({ error: message }, { status: 400 }),
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

describe("admin location history validation", () => {
  let getLocationHistoryRoute: (typeof import("@/app/api/admin/location/history/[userId]/route"))["GET"];

  beforeAll(async () => {
    ({ GET: getLocationHistoryRoute } =
      await import("@/app/api/admin/location/history/[userId]/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
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

  it("returns 400 for invalid startDate before calling location service", async () => {
    const response = await getLocationHistoryRoute(
      new NextRequest(
        "http://localhost/api/admin/location/history/user-1?startDate=invalid-date",
      ),
      {
        params: { userId: "user-1" },
        session: { user: { id: "admin-1", tenantId: "tenant-1" } },
        permissions: [],
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Parameter tanggal tidak valid");
    expect(mockFns.getLocationHistory).not.toHaveBeenCalled();
    expect(mockFns.getLocationStats).not.toHaveBeenCalled();
  });
});
