import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetMobileAuthPayload, mockGetMobileGroups } = vi.hoisted(() => ({
  mockGetMobileAuthPayload: vi.fn(),
  mockGetMobileGroups: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: (request: Request) => mockGetMobileAuthPayload(request),
}));

vi.mock("@/modules/integrations", () => ({
  getMixRadiusGroupRouteService: () => ({
    getMobileGroups: mockGetMobileGroups,
  }),
}));

import { GET } from "@/app/api/mobile/mixradius/groups/route";

describe("GET /api/mobile/mixradius/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMobileAuthPayload.mockResolvedValue({
      permissions: ["m_mixradius:read"],
      siteId: "site-1",
    });
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

    const response = await GET(
      new NextRequest("http://localhost/api/mobile/mixradius/groups"),
    );
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

  it("returns all groups when the mobile user has no site restriction", async () => {
    mockGetMobileAuthPayload.mockResolvedValue({
      permissions: ["m_mixradius:read"],
      siteId: null,
    });
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
        isActive: false,
      },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/mobile/mixradius/groups"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
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
        {
          id: "group-2",
          name: "Site B",
          owners: ["owner-b"],
          isActive: false,
        },
      ],
    });
  });

  it("returns 403 when mobile user lacks mixradius read permission", async () => {
    mockGetMobileAuthPayload.mockResolvedValue({
      permissions: [],
      siteId: "site-1",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/mobile/mixradius/groups"),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json).toEqual({
      success: false,
      error: "Dilarang: Memerlukan izin m_mixradius:read",
      code: "FORBIDDEN",
    });
    expect(mockGetMobileGroups).not.toHaveBeenCalled();
  });

  it("returns 500 when group retrieval fails unexpectedly", async () => {
    mockGetMobileGroups.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(
      new NextRequest("http://localhost/api/mobile/mixradius/groups"),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: "Gagal mengambil grup MixRadius",
      code: "INTERNAL_ERROR",
    });
  });
});
