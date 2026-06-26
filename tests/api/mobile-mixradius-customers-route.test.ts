import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyMobileToken, mockFetchCustomersPPP, mockGetUserSiteIds } =
  vi.hoisted(() => ({
    mockVerifyMobileToken: vi.fn(),
    mockFetchCustomersPPP: vi.fn(),
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

vi.mock("@/modules/integrations", () => {
  class MixRadiusConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "MixRadiusConfigError";
    }
  }

  class MixRadiusService {
    fetchCustomersPPP = mockFetchCustomersPPP;
  }

  return {
    MixRadiusConfigError,
    MixRadiusService,
  };
});

vi.mock("@/modules/roles", () => ({
  getUserSiteIds: (...args: unknown[]) => mockGetUserSiteIds(...args),
}));

import { GET } from "@/app/api/mobile/mixradius/customers/route";

const authedRequest = (url: string) =>
  new NextRequest(url, { headers: { Authorization: "Bearer valid-token" } });

const routeCtx = { params: Promise.resolve({}) };

describe("GET /api/mobile/mixradius/customers", () => {
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

  it("returns paginated customers payload and forwards mobile filters", async () => {
    mockFetchCustomersPPP.mockResolvedValue({
      draw: 1,
      recordsTotal: 77,
      recordsFiltered: 12,
      data: [
        {
          id: "cust-1",
          member_id: "member-1",
          username: "andi",
          fullname: "Andi Teknisi",
          phonenumber: "08123456789",
          address: "Jl. Mawar",
          plan_name: "20 Mbps",
          owner_name: "Owner A",
          auth_status: "Disabled-Users",
          expired_on: "2026-04-30 00:00:00",
          online: false,
        },
      ],
    });

    const request = authedRequest(
      "http://localhost/api/mobile/mixradius/customers?search=&groupId=group-1&authStatus=Disabled-Users&start=0&length=100&draw=1&searchType=all",
    );

    const response = await GET(request, routeCtx);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockFetchCustomersPPP).toHaveBeenCalledWith({
      search: "",
      length: 100,
      start: 0,
      searchType: "all",
      groupId: "group-1",
      authStatus: "Disabled-Users",
      siteIds: ["site-1"],
    });
    expect(json).toEqual({
      success: true,
      data: {
        draw: 1,
        recordsTotal: 77,
        recordsFiltered: 12,
        data: [
          {
            id: "cust-1",
            member_id: "member-1",
            username: "andi",
            fullname: "Andi Teknisi",
            phonenumber: "08123456789",
            address: "Jl. Mawar",
            plan_name: "20 Mbps",
            owner_name: "Owner A",
            auth_status: "Disabled-Users",
            expired_on: "2026-04-30 00:00:00",
            online: false,
          },
        ],
      },
    });
  });

  it("falls back to list length when upstream pagination metadata is missing", async () => {
    mockFetchCustomersPPP.mockResolvedValue({
      data: [
        {
          id: "cust-2",
          member_id: "member-2",
          username: "budi",
          fullname: "Budi Isolir",
          phonenumber: "08999999999",
          address: "Jl. Melati",
          plan_name: "30 Mbps",
          owner_name: "Owner B",
          auth_status: "Disabled-Users",
          expired_on: "2026-05-01 00:00:00",
          online: true,
        },
      ],
    });

    const request = authedRequest(
      "http://localhost/api/mobile/mixradius/customers?search=budi",
    );

    const response = await GET(request, routeCtx);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      data: {
        draw: 1,
        recordsTotal: 1,
        recordsFiltered: 1,
        data: [
          {
            id: "cust-2",
            member_id: "member-2",
            username: "budi",
            fullname: "Budi Isolir",
            phonenumber: "08999999999",
            address: "Jl. Melati",
            plan_name: "30 Mbps",
            owner_name: "Owner B",
            auth_status: "Disabled-Users",
            expired_on: "2026-05-01 00:00:00",
            online: true,
          },
        ],
      },
    });
  });

  it("forwards all user siteIds to fetchCustomersPPP for multi-site users", async () => {
    mockGetUserSiteIds.mockReturnValue(["site-1", "site-2"]);

    mockFetchCustomersPPP.mockResolvedValue({
      draw: 1,
      recordsTotal: 5,
      recordsFiltered: 5,
      data: [
        {
          id: "cust-3",
          member_id: "member-3",
          username: "multi",
          fullname: "Multi Site User",
          phonenumber: "08111111111",
          address: "Jl. Multi",
          plan_name: "50 Mbps",
          owner_name: "Owner C",
          auth_status: "Enabled-Users",
          expired_on: "2026-06-01 00:00:00",
          online: false,
        },
      ],
    });

    const request = authedRequest(
      "http://localhost/api/mobile/mixradius/customers?authStatus=Isolir&start=0&length=20&search=&searchType=all",
    );

    await GET(request, routeCtx);

    expect(mockFetchCustomersPPP).toHaveBeenCalledWith(
      expect.objectContaining({ siteIds: ["site-1", "site-2"] }),
    );
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

    const request = authedRequest(
      "http://localhost/api/mobile/mixradius/customers?search=andi",
    );

    const response = await GET(request, routeCtx);

    expect(response.status).toBe(403);
    expect(mockFetchCustomersPPP).not.toHaveBeenCalled();
  });

  it("returns a 503 when MixRadius config is invalid", async () => {
    const configError = new Error("Integrasi MixRadius belum dikonfigurasi");
    configError.name = "MixRadiusConfigError";
    mockFetchCustomersPPP.mockRejectedValue(configError);

    const request = authedRequest(
      "http://localhost/api/mobile/mixradius/customers?search=yan",
    );

    const response = await GET(request, routeCtx);
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json).toEqual({
      success: false,
      error: "Integrasi MixRadius belum dikonfigurasi",
      code: "MIXRADIUS_CONFIG_ERROR",
    });
  });

  it("keeps generic 500 mapping for unexpected search failures", async () => {
    mockFetchCustomersPPP.mockRejectedValue(
      new Error("unexpected upstream failure"),
    );

    const request = authedRequest(
      "http://localhost/api/mobile/mixradius/customers?search=yan",
    );

    const response = await GET(request, routeCtx);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: "Gagal mencari pelanggan",
      code: "INTERNAL_ERROR",
    });
  });
});
