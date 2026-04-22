import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  mixRadiusOwnerGroupFindMany: vi.fn(),
  mixRadiusOwnerGroupFindUnique: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/prisma-billing", () => ({
  prismaBilling: {
    mixRadiusOwnerGroup: {
      findMany: mockFns.mixRadiusOwnerGroupFindMany,
      findUnique: mockFns.mixRadiusOwnerGroupFindUnique,
    },
  },
}));

import {
  fetchMixRadiusCustomersPPP,
  type MixRadiusCustomerCacheState,
} from "@/modules/integrations/services/mixradius-customer-client";

describe("fetchMixRadiusCustomersPPP site filters", () => {
  const cache: MixRadiusCustomerCacheState = {
    data: [],
    expiresAt: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.mixRadiusOwnerGroupFindMany.mockResolvedValue([
      {
        owners: ["Owner A - Cabang Timur"],
      },
    ]);
    mockFns.mixRadiusOwnerGroupFindUnique.mockResolvedValue(null);
    mockFns.post.mockResolvedValue({
      data: {
        data: [
          {
            id: "cust-1",
            username: "andi",
            member_id: "member-1",
            fullname: "Andi Teknisi",
            address: "Jl. Mawar",
            phonenumber: "08123",
            plan_name: "20 Mbps",
            owner_name: "Owner A - Cabang Timur",
            auth_status: "Disabled-Users",
            expired_on: "2099-01-01",
          },
        ],
      },
    });
  });

  it("keeps customers whose owner_name matches the site owner with suffixes", async () => {
    const result = await fetchMixRadiusCustomersPPP({
      client: {
        post: mockFns.post,
      } as never,
      baseUrl: "https://mixradius.example.com",
      login: vi.fn().mockResolvedValue(undefined),
      onSessionExpired: vi.fn(),
      randomDelay: vi.fn().mockResolvedValue(undefined),
      cache,
      customersCacheTtl: 60_000,
      onResetClient: vi.fn(),
      filters: {
        siteId: "site-1",
        authStatus: "Disabled-Users",
      },
    });

    expect(result.result.data).toHaveLength(1);
    expect(result.result.data[0]?.owner_name).toBe("Owner A - Cabang Timur");
  });

  it("matches ownerName filter using normalized owner prefix", async () => {
    const result = await fetchMixRadiusCustomersPPP({
      client: {
        post: mockFns.post,
      } as never,
      baseUrl: "https://mixradius.example.com",
      login: vi.fn().mockResolvedValue(undefined),
      onSessionExpired: vi.fn(),
      randomDelay: vi.fn().mockResolvedValue(undefined),
      cache,
      customersCacheTtl: 60_000,
      onResetClient: vi.fn(),
      filters: {
        ownerName: "Owner A",
        authStatus: "Disabled-Users",
      },
    });

    expect(result.result.data).toHaveLength(1);
    expect(result.result.data[0]?.owner_name).toBe("Owner A - Cabang Timur");
  });

  it("fails fast when upstream keeps returning login HTML after one retry", async () => {
    const onSessionExpired = vi.fn();
    const onResetClient = vi.fn();
    const client = {
      post: vi
        .fn()
        .mockResolvedValueOnce({
          data: "<!DOCTYPE html><html><title>LOGIN</title></html>",
        })
        .mockResolvedValueOnce({
          data: "<!DOCTYPE html><html><title>LOGIN</title></html>",
        }),
    };

    await expect(
      fetchMixRadiusCustomersPPP({
        client: client as never,
        baseUrl: "https://mixradius.example.com",
        login: vi.fn().mockResolvedValue(undefined),
        onSessionExpired,
        randomDelay: vi.fn().mockResolvedValue(undefined),
        cache,
        customersCacheTtl: 60_000,
        onResetClient,
        filters: {
          authStatus: "Disabled-Users",
        },
      }),
    ).rejects.toThrow();

    expect(client.post).toHaveBeenCalledTimes(2);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(onResetClient).toHaveBeenCalledTimes(1);
  });
});
