import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresi: login pelanggan di `pelanggan.<domain>` membalas 500.
 *
 * Host portal dulu semuanya dikembalikan sebagai "tanpa tenant" dengan alasan
 * "ditangani proxy.ts". Untuk portal staf itu benar — tenant mereka datang dari
 * sesi NextAuth. Portal pelanggan berbeda: saat login diproses belum ada cookie
 * sama sekali, sehingga host adalah satu-satunya sumber tenant. Akibatnya
 * pencarian pelanggan berjalan tanpa tenant context dan ekstensi Prisma
 * melemparkan TenantContextError.
 *
 * Terverifikasi di produksi: `POST /api/customer/auth/login` membalas 500 di
 * `pelanggan.radpro.id` tetapi 401 yang benar di apex, dengan log
 * `TenantContextError: Attempted data access without valid tenant context:
 * Pelanggan.findFirst`.
 */

const mockFns = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
  getToken: vi.fn(),
  jwtVerify: vi.fn(),
  findFirst: vi.fn(),
  tenantDomainFindFirst: vi.fn(),
  tenantDomainFindUnique: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockFns.headers,
  cookies: mockFns.cookies,
}));

vi.mock("next-auth/jwt", () => ({
  getToken: mockFns.getToken,
}));

vi.mock("jose", () => ({
  jwtVerify: mockFns.jwtVerify,
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    tenant: { findFirst: mockFns.findFirst },
    tenantDomain: {
      findFirst: mockFns.tenantDomainFindFirst,
      findUnique: mockFns.tenantDomainFindUnique,
    },
  },
}));

const withHost = (host: string) =>
  mockFns.headers.mockResolvedValue(new Headers({ host }));

const resolveContext = async () => {
  const { getTenantIdFromContext } = await import("@/lib/tenant-context");
  return getTenantIdFromContext();
};

describe("tenant context pada host portal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/tenant-context");
    for (const fn of Object.values(mockFns)) fn.mockReset();

    mockFns.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    mockFns.getToken.mockResolvedValue(null);
    mockFns.tenantDomainFindFirst.mockResolvedValue(null);
    mockFns.tenantDomainFindUnique.mockResolvedValue(null);
    mockFns.findFirst.mockResolvedValue(null);
    (globalThis as Record<string, unknown>).IS_CUSTOM_SERVER = false;
    process.env.NEXTAUTH_SECRET = "test-secret-123-at-least-32-chars-long";
    process.env.DOMAIN = "radpro.id";
  });

  it("memetakan portal pelanggan ke tenant utama", async () => {
    withHost("pelanggan.radpro.id");
    const { MAIN_TENANT_ID } = await import("@/lib/tenant-constants");

    expect(await resolveContext()).toEqual({
      tenantId: MAIN_TENANT_ID,
      isSuperAdmin: false,
    });
  }, 20000);

  it("memetakan portal pelanggan staging ke tenant utama", async () => {
    withHost("pelanggan-staging.radpro.id");
    const { MAIN_TENANT_ID } = await import("@/lib/tenant-constants");

    expect(await resolveContext()).toEqual({
      tenantId: MAIN_TENANT_ID,
      isSuperAdmin: false,
    });
  }, 20000);

  // Portal staf tetap fail-closed: host tidak boleh jadi sumber otoritas
  // karena tenant mereka ada di dalam sesi.
  it.each(["admin.radpro.id", "karyawan.radpro.id", "investor.radpro.id"])(
    "tidak memberi tenant dari host untuk %s",
    async (host) => {
      withHost(host);

      expect(await resolveContext()).toEqual({
        tenantId: null,
        isSuperAdmin: false,
      });
    },
    20000,
  );

  // Subdomain slug tenant harus tetap diselesaikan lewat tabel TenantDomain,
  // bukan tertelan aturan portal.
  it("tetap menyelesaikan subdomain slug tenant", async () => {
    withHost("acme.radpro.id");
    mockFns.tenantDomainFindUnique.mockResolvedValue({
      tenantId: "tenant-acme",
      status: "active",
    });

    expect(await resolveContext()).toEqual({
      tenantId: "tenant-acme",
      isSuperAdmin: false,
    });
  }, 20000);
});
