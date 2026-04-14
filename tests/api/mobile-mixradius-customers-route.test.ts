import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetMobileAuthPayload, mockFetchCustomersPPP } = vi.hoisted(() => ({
  mockGetMobileAuthPayload: vi.fn(),
  mockFetchCustomersPPP: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: (request: Request) => mockGetMobileAuthPayload(request),
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

import { GET } from "@/app/api/mobile/mixradius/customers/route";

describe("GET /api/mobile/mixradius/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetMobileAuthPayload.mockResolvedValue({
      permissions: ["m_mixradius:read"],
      siteId: "site-1",
    });
  });

  it("allows empty search for selected group and forwards mobile filters", async () => {
    mockFetchCustomersPPP.mockResolvedValue({
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
          online: false,
        },
      ],
    });

    const request = new NextRequest(
      "http://localhost/api/mobile/mixradius/customers?search=&groupId=group-1&authStatus=Disabled-Users&start=0&length=100&draw=1&searchType=all",
    );

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockFetchCustomersPPP).toHaveBeenCalledWith({
      search: "",
      length: 100,
      start: 0,
      searchType: "all",
      groupId: "group-1",
      authStatus: "Disabled-Users",
      siteId: "site-1",
    });
    expect(json).toEqual({
      success: true,
      data: [
        {
          id: "cust-1",
          memberId: "member-1",
          username: "andi",
          fullname: "Andi Teknisi",
          phone: "08123456789",
          address: "Jl. Mawar",
          planName: "20 Mbps",
          ownerName: "Owner A",
          status: "Disabled-Users",
          isOnline: false,
        },
      ],
    });
  });

  it("returns a 503 when MixRadius config is invalid", async () => {
    const configError = new Error("Integrasi MixRadius belum dikonfigurasi");
    configError.name = "MixRadiusConfigError";
    mockFetchCustomersPPP.mockRejectedValue(configError);

    const request = new NextRequest(
      "http://localhost/api/mobile/mixradius/customers?search=yan",
    );

    const response = await GET(request);
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

    const request = new NextRequest(
      "http://localhost/api/mobile/mixradius/customers?search=yan",
    );

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: "Gagal mencari pelanggan",
      code: "INTERNAL_ERROR",
    });
  });
});
