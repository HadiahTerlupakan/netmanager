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
    badRequest: (message: string) =>
      NextResponse.json({ error: message }, { status: 400 }),
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

describe("admin location history validation", () => {
  let getLocationHistoryRoute: (typeof import("@/app/api/admin/location/history/[userId]/route"))["GET"];

  beforeAll(async () => {
    ({ GET: getLocationHistoryRoute } =
      await import("@/app/api/admin/location/history/[userId]/route"));
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    const { AdminLocationRouteError } = await import("@/modules/attendance");
    const validationError = new Error(
      "Parameter tanggal tidak valid",
    ) as Error & {
      status: number;
    };
    validationError.status = 400;
    Object.setPrototypeOf(validationError, AdminLocationRouteError.prototype);
    mockFns.getLocationHistory.mockRejectedValue(validationError);
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
    expect(mockFns.getLocationHistory).toHaveBeenCalledWith({
      userId: "user-1",
      startDate: "invalid-date",
      endDate: null,
      permissions: [],
      session: { user: { id: "admin-1", tenantId: "tenant-1" } },
    });
  });
});
