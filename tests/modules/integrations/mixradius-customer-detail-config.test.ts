import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  login: vi.fn(),
  randomDelay: vi.fn(),
  get: vi.fn(),
  fetchCustomersPPP: vi.fn(),
  onSessionExpired: vi.fn(),
  mixRadiusOwnerGroupFindMany: vi.fn(),
  mixRadiusOwnerGroupFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma-billing", () => ({
  prismaBilling: {
    mixRadiusOwnerGroup: {
      findMany: mockFns.mixRadiusOwnerGroupFindMany,
      findUnique: mockFns.mixRadiusOwnerGroupFindUnique,
    },
  },
}));

import { fetchMixRadiusCustomerDetail } from "@/modules/integrations/services/mixradius-customer-client";

describe("fetchMixRadiusCustomerDetail config errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.randomDelay.mockResolvedValue(undefined);
    mockFns.fetchCustomersPPP.mockResolvedValue({
      draw: 1,
      recordsTotal: 0,
      recordsFiltered: 0,
      data: [],
    });
  });

  it("throws a MixRadius config error instead of returning placeholder customer data", async () => {
    const configError = new Error(
      "URL MixRadius tidak valid atau belum dikonfigurasi.",
    );
    configError.name = "MixRadiusConfigError";
    mockFns.login.mockRejectedValue(configError);

    await expect(
      fetchMixRadiusCustomerDetail({
        client: {
          get: mockFns.get,
        } as never,
        baseUrl: "https://mixradius.example.com",
        login: mockFns.login,
        onSessionExpired: mockFns.onSessionExpired,
        randomDelay: mockFns.randomDelay,
        customerId: "cust-1",
        fetchCustomersPPP: mockFns.fetchCustomersPPP,
      }),
    ).rejects.toMatchObject({
      name: "MixRadiusConfigError",
      message: "URL MixRadius tidak valid atau belum dikonfigurasi.",
    });
  });
});
