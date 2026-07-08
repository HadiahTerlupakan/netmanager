import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  getLiveLocations: vi.fn(),
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
      message: string,
      public readonly status: number,
    ) {
      super(message);
    }
  },
  AdminLocationRouteService: class MockAdminLocationRouteService {
    getLiveLocations = mockFns.getLiveLocations;
  },
  LOCATION_LIVE_FORBIDDEN_MESSAGE:
    "Anda tidak memiliki akses untuk melihat live tracking",
}));

describe("GET /api/admin/location/live", () => {
  let getLiveRoute: (typeof import("@/app/api/admin/location/live/route"))["GET"];

  beforeAll(async () => {
    ({ GET: getLiveRoute } =
      await import("@/app/api/admin/location/live/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.getLiveLocations.mockResolvedValue({
      locations: [],
      tenantId: "tenant-1",
    });
  });

  const makeRequest = () =>
    new NextRequest("http://localhost/api/admin/location/live");

  const makeCtx = (overrides?: object) =>
    ({
      params: {},
      session: { user: { id: "admin-1", tenantId: "tenant-1" } },
      permissions: [],
      ...overrides,
    }) as never;

  // ── happy path ────────────────────────────────────────────────────────────

  it("returns 200 with locations when user has live_tracking:read permission", async () => {
    // Given: admin with permission, service returns 2 locations
    mockFns.getLiveLocations.mockResolvedValue({
      locations: [
        {
          userId: "u1",
          userName: "Alice",
          latitude: -6.2,
          longitude: 106.8,
          isMoving: false,
        },
        {
          userId: "u2",
          userName: "Bob",
          latitude: -6.3,
          longitude: 106.9,
          isMoving: true,
        },
      ],
      tenantId: "tenant-1",
    });

    // When
    const response = await getLiveRoute(makeRequest(), makeCtx());
    const body = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(body.data.locations).toHaveLength(2);
    expect(body.data.tenantId).toBe("tenant-1");
  });

  // ── auth guard ────────────────────────────────────────────────────────────

  it("returns 403 when user does not have live_tracking:read permission", async () => {
    // Given: no permission
    mockFns.hasPermission.mockResolvedValue(false);

    // When
    const response = await getLiveRoute(makeRequest(), makeCtx());

    // Then
    expect(response.status).toBe(403);
    expect(mockFns.getLiveLocations).not.toHaveBeenCalled();
  });

  // ── error handling ────────────────────────────────────────────────────────

  it("returns 401 when service throws AdminLocationRouteError with status 401", async () => {
    // Given: service throws 401 (user not found in tenant)
    const { AdminLocationRouteError } = await import("@/modules/attendance");
    mockFns.getLiveLocations.mockRejectedValue(
      new AdminLocationRouteError("Unauthorized", 401),
    );

    // When
    const response = await getLiveRoute(makeRequest(), makeCtx());

    // Then
    expect(response.status).toBe(401);
  });

  it("returns 403 when service throws AdminLocationRouteError with status 403", async () => {
    // Given: scope restriction — admin can only see own site
    const { AdminLocationRouteError, LOCATION_LIVE_FORBIDDEN_MESSAGE } =
      await import("@/modules/attendance");
    mockFns.getLiveLocations.mockRejectedValue(
      new AdminLocationRouteError(LOCATION_LIVE_FORBIDDEN_MESSAGE, 403),
    );

    // When
    const response = await getLiveRoute(makeRequest(), makeCtx());
    const body = await response.json();

    // Then
    expect(response.status).toBe(403);
    expect(body.error).toBe(LOCATION_LIVE_FORBIDDEN_MESSAGE);
  });

  it("returns 400 when service throws AdminLocationRouteError with status 400", async () => {
    // Given: invalid parameter
    const { AdminLocationRouteError } = await import("@/modules/attendance");
    mockFns.getLiveLocations.mockRejectedValue(
      new AdminLocationRouteError("Parameter tidak valid", 400),
    );

    // When
    const response = await getLiveRoute(makeRequest(), makeCtx());
    const body = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(body.error).toBe("Parameter tidak valid");
  });

  it("rethrows unknown errors (non-AdminLocationRouteError)", async () => {
    // Given: unexpected runtime error
    mockFns.getLiveLocations.mockRejectedValue(new Error("DB connection lost"));

    // When / Then
    await expect(getLiveRoute(makeRequest(), makeCtx())).rejects.toThrow(
      "DB connection lost",
    );
  });
});
