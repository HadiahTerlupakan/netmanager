import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  getLocationHistory: vi.fn(),
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

vi.mock("@/modules/attendance", () => ({
  AdminLocationRouteError: class MockAdminLocationRouteError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  AdminLocationRouteService: class MockAdminLocationRouteService {
    getLocationHistory = mockFns.getLocationHistory;
  },
  LOCATION_READ_FORBIDDEN_MESSAGE:
    "Anda tidak memiliki akses untuk melihat history lokasi user ini",
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
    mockFns.getLocationHistory.mockResolvedValue({
      history: [],
      stats: {
        totalPoints: 0,
        firstLocation: null,
        lastLocation: null,
        totalDistance: 0,
      },
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
    expect(mockFns.getLocationHistory).toHaveBeenCalledWith({
      userId: "user-1",
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: "2026-04-03T23:59:59.999Z",
      permissions: [],
      session: { user: { id: "admin-1", tenantId: "tenant-1" } },
    });
  });

  it("rejects history access outside the admin site scope", async () => {
    const { AdminLocationRouteError } = await import("@/modules/attendance");
    const forbiddenError = new Error("Forbidden") as Error & { status: number };
    forbiddenError.status = 403;
    Object.setPrototypeOf(forbiddenError, AdminLocationRouteError.prototype);
    mockFns.getLocationHistory.mockRejectedValueOnce(forbiddenError);

    const response = await getLocationHistoryRoute(
      new NextRequest("http://localhost/api/admin/location/history/user-2"),
      {
        params: { userId: "user-2" },
        session: { user: { id: "admin-1", tenantId: "tenant-1" } },
        permissions: ["live_tracking:site_only"],
      } as never,
    );

    expect(response.status).toBe(403);
    expect(mockFns.getLocationHistory).toHaveBeenCalledWith({
      userId: "user-2",
      startDate: null,
      endDate: null,
      permissions: ["live_tracking:site_only"],
      session: { user: { id: "admin-1", tenantId: "tenant-1" } },
    });
  });
});
