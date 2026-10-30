import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePelangganAccessToken } from "@/lib/jwt";

const mockFns = vi.hoisted(() => ({
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockFns.headers,
  cookies: async (): Promise<{ get: () => undefined }> => ({
    get: () => undefined,
  }),
}));
// Staff and investor verification reject a customer token; only the customer
// path may claim it.
vi.mock("@/lib/mobile-auth", () => ({
  verifyMobileToken: async (): Promise<null> => null,
}));
vi.mock("@/lib/mobile-investor-auth", () => ({
  verifyInvestorMobileToken: async (): Promise<null> => null,
}));

/**
 * The app sends customers' requests with a Bearer customer token, which the
 * tenant context did not recognise: it fell back to the host, so on
 * radpro.id (not mapped to a tenant in production) every /api/customer/*
 * call failed with TenantContextError, and a partner's customer could never
 * have been resolved to their own tenant anyway.
 */
function bearer(token: string, host = "api.contoh-isp.id") {
  return new Headers({ authorization: `Bearer ${token}`, host });
}

const tokenPelanggan = (tenantId: string | null) =>
  generatePelangganAccessToken({
    id: "p-1",
    idPelanggan: "10000001",
    nama: "Budi",
    username: "budi",
    status: "AKTIF",
    tenantId,
  });

describe("tenant context from a customer's Bearer token", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/tenant-context");
    mockFns.headers.mockReset();
    (globalThis as Record<string, unknown>).IS_CUSTOM_SERVER = false;
  });

  it("takes the tenant from the customer's token", async () => {
    mockFns.headers.mockResolvedValue(bearer(tokenPelanggan("tenant-mitra")));
    const { getTenantIdFromContext } = await import("@/lib/tenant-context");

    await expect(getTenantIdFromContext()).resolves.toEqual({
      tenantId: "tenant-mitra",
      isSuperAdmin: false,
    });
  });

  it("ignores a token that is not a valid customer token", async () => {
    mockFns.headers.mockResolvedValue(bearer("bukan-token"));
    const { getTenantIdFromContext } = await import("@/lib/tenant-context");

    const context = await getTenantIdFromContext();

    expect(context.tenantId).not.toBe("tenant-mitra");
    expect(context.isSuperAdmin).toBe(false);
  });
});
