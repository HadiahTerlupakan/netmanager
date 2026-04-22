import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  loadMixRadiusCredentials: vi.fn(),
  wrapper: vi.fn(),
  axiosCreate: vi.fn(),
  fetchMixRadiusCustomersPPP: vi.fn(),
  fetchMixRadiusOwnersWithIds: vi.fn(),
}));

vi.mock("@/modules/integrations/services/mixradius-auth-client", () => ({
  loadMixRadiusCredentials: mockFns.loadMixRadiusCredentials,
  loginMixRadius: vi.fn().mockResolvedValue({
    isLoggedIn: true,
    loginExpiresAt: Date.now() + 60_000,
    loggedInCredentials: {
      username: "fresh-user",
      baseUrl: "https://fresh.example.com",
    },
  }),
}));

vi.mock("axios", () => ({
  default: {
    create: mockFns.axiosCreate,
  },
}));

vi.mock("axios-cookiejar-support", () => ({
  wrapper: mockFns.wrapper,
}));

vi.mock("tough-cookie", () => ({
  CookieJar: class MockCookieJar {},
}));

vi.mock(
  "@/modules/integrations/services/mixradius-customer-client",
  async () => {
    const actual = await vi.importActual<
      typeof import("@/modules/integrations/services/mixradius-customer-client")
    >("@/modules/integrations/services/mixradius-customer-client");

    return {
      ...actual,
      fetchMixRadiusCustomersPPP: mockFns.fetchMixRadiusCustomersPPP,
      fetchMixRadiusActiveSessionsPPP: vi.fn(),
      fetchMixRadiusCustomerDetail: vi.fn(),
      fetchMixRadiusInvoiceCounts: vi.fn(),
    };
  },
);

vi.mock("@/modules/integrations/services/mixradius-income-client", () => ({
  deleteMixRadiusIncomeRecord: vi.fn(),
  fetchMixRadiusIncomeByPeriod: vi.fn(),
  fetchMixRadiusIncomeSummary: vi.fn(),
  fetchMixRadiusOwnersWithIds: mockFns.fetchMixRadiusOwnersWithIds,
  fetchMixRadiusProfitReport: vi.fn(),
  fetchMixRadiusUniqueOwners: vi.fn(),
  getMixRadiusPrintInvoiceHtml: vi.fn(),
}));

vi.mock("@/modules/integrations/services/mixradius-topology-client", () => ({
  fetchMixRadiusODPCustomers: vi.fn(),
  fetchMixRadiusODPList: vi.fn(),
  fetchMixRadiusTopologyData: vi.fn(),
}));

vi.mock(
  "@/modules/integrations/services/mixradius-owner-group-service",
  () => ({
    getMixRadiusOwnerGroupService: vi.fn(() => ({
      getOwnerGroups: vi.fn(),
      getOwnerGroup: vi.fn(),
      createOwnerGroup: vi.fn(),
      updateOwnerGroup: vi.fn(),
      deleteOwnerGroup: vi.fn(),
    })),
  }),
);

import { MixRadiusService } from "@/modules/integrations/services/MixRadiusService";

describe("MixRadiusService credential refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.axiosCreate.mockImplementation(() => ({
      post: vi.fn(),
      get: vi.fn(),
    }));
    mockFns.wrapper.mockImplementation((client) => client);
  });

  it("uses refreshed baseUrl from latest credentials when fetching customers", async () => {
    mockFns.loadMixRadiusCredentials.mockResolvedValue({
      username: "fresh-user",
      password: "fresh-pass",
      baseUrl: "https://fresh.example.com",
    });
    mockFns.fetchMixRadiusCustomersPPP.mockImplementation(async (params) => ({
      result: { draw: 1, recordsTotal: 0, recordsFiltered: 0, data: [] },
      cache: params.cache,
    }));

    const service = new MixRadiusService();

    await service.fetchCustomersPPP({ search: "yud" });

    expect(mockFns.fetchMixRadiusCustomersPPP).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://fresh.example.com",
      }),
    );
  });

  it("uses refreshed baseUrl from latest credentials when fetching owners", async () => {
    mockFns.loadMixRadiusCredentials.mockResolvedValue({
      username: "fresh-user",
      password: "fresh-pass",
      baseUrl: "https://fresh.example.com",
    });
    mockFns.fetchMixRadiusOwnersWithIds.mockResolvedValue([]);

    const service = new MixRadiusService();

    await service.getOwnersWithIds();

    expect(mockFns.fetchMixRadiusOwnersWithIds).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://fresh.example.com",
      }),
    );
  });
});
