import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyMobileToken, mockGetMobileGroups, mockGetUserSiteIds } =
  vi.hoisted(() => ({
    mockVerifyMobileToken: vi.fn(),
    mockGetMobileGroups: vi.fn(),
    mockGetUserSiteIds: vi.fn(),
  }));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenDetails: vi.fn().mockResolvedValue(null),
  verifyMobileToken: (...args: unknown[]) => mockVerifyMobileToken(...args),
}));

vi.mock("@/lib/middleware/request-logger", () => ({
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  logAuditActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/integrations", () => ({
  getMixRadiusGroupRouteService: () => ({
    getMobileGroups: mockGetMobileGroups,
  }),
}));

vi.mock("@/modules/roles", () => ({
  getUserSiteIds: (...args: unknown[]) => mockGetUserSiteIds(...args),
}));

import { GET } from "@/app/api/mobile/mixradius/groups/route";

const authedRequest = (url = "http://localhost/api/mobile/mixradius/groups") =>
  new NextRequest(url, { headers: { Authorization: "Bearer valid-token" } });

const routeCtx = { params: Promise.resolve({}) };

describe("GET /api/mobile/mixradius/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyMobileToken.mockResolvedValue({
      userId: "user-1",
      role: "TEKNISI",
      tenantId: "tenant-1",
      siteId: "site-1",
      permissions: ["m_mixradius:read"],
      isSuperAdmin: false,
    });
    mockGetUserSiteIds.mockReturnValue(["site-1"]);
  });

  it("returns only groups that match the mobile user's site", async () => {
    mockGetMobileGroups.mockResolvedValue([
      {
        id: "group-1",
        name: "Site A",
        owners: ["owner-a"],
        isActive: true,
        siteId: "site-1",
      },
    ]);

    const response = await GET(authedRequest(), routeCtx);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetMobileGroups).toHaveBeenCalledTimes(1);
    expect(json).toEqual({
      success: true,
      data: [
        {
          id: "group-1",
          name: "Site A",
          owners: ["owner-a"],
          isActive: true,
          siteId: "site-1",
        },
      ],
    });
  });

  it("returns all matching groups for multi-site users", async () => {
    mockGetUserSiteIds.mockReturnValue(["site-1", "site-2"]);

    mockGetMobileGroups.mockResolvedValue([
      {
        id: "group-1",
        name: "Site A",
        owners: ["owner-a"],
        isActive: true,
        siteId: "site-1",
      },
      {
        id: "group-2",
        name: "Site B",
        owners: ["owner-b"],
        isActive: true,
        siteId: "site-2",
      },
    ]);

    const response = await GET(authedRequest(), routeCtx);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetMobileGroups).toHaveBeenCalledWith(
      ["site-1", "site-2"],
      "tenant-1",
    );
    expect(json.data).toHaveLength(2);
  });

  it("returns empty array when the mobile user has no site assignment", async () => {
    mockVerifyMobileToken.mockResolvedValue({
      userId: "user-1",
      role: "TEKNISI",
      tenantId: "tenant-1",
      siteId: null,
      permissions: ["m_mixradius:read"],
      isSuperAdmin: false,
    });
    mockGetUserSiteIds.mockReturnValue([]);
    mockGetMobileGroups.mockResolvedValue([]);

    const response = await GET(authedRequest(), routeCtx);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      data: [],
    });
  });

  it("returns 403 when mobile user lacks mixradius read permission", async () => {
    mockVerifyMobileToken.mockResolvedValue({
      userId: "user-1",
      role: "TEKNISI",
      tenantId: "tenant-1",
      siteId: "site-1",
      permissions: [],
      isSuperAdmin: false,
    });

    const response = await GET(authedRequest(), routeCtx);

    expect(response.status).toBe(403);
    expect(mockGetMobileGroups).not.toHaveBeenCalled();
  });

  it("returns 500 when group retrieval fails unexpectedly", async () => {
    mockGetMobileGroups.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(authedRequest(), routeCtx);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: "Gagal mengambil grup MixRadius",
      code: "INTERNAL_ERROR",
    });
  });
});
