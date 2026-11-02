import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAll: vi.fn(),
  checkTenant: vi.fn(),
  testRouterConnection: vi.fn(),
}));

vi.mock("@/modules/network/services/mikrotik-ping-check", () => ({
  checkAllMikroTikRouterStatus: mocks.checkAll,
  checkTenantMikroTikRouterStatus: mocks.checkTenant,
}));
vi.mock("@/modules/network/services/mikrotik-router.connection-test", () => ({
  testRouterConnection: mocks.testRouterConnection,
}));

import { MikroTikRouterService } from "@/modules/network/services/MikroTikRouterService";

function serviceWith(opts: {
  router?: { id: string; siteId: string | null } | null;
  userSiteId?: string | null;
}) {
  const routerRepository = {
    findById: vi.fn().mockResolvedValue(opts.router ?? null),
  };
  const networkRepository = {
    findUserSite: vi
      .fn()
      .mockResolvedValue({ siteId: opts.userSiteId ?? null }),
  };
  return new MikroTikRouterService(
    routerRepository as never,
    networkRepository as never,
  );
}

describe("MikroTikRouterService — lingkup site & tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAll.mockResolvedValue(99);
    mocks.checkTenant.mockResolvedValue(3);
    mocks.testRouterConnection.mockResolvedValue({
      apiResult: { success: true },
    });
  });

  it("uji koneksi router site lain ditolak sebelum menghubungi router", async () => {
    const service = serviceWith({
      router: { id: "r1", siteId: "site-b" },
      userSiteId: "site-a",
    });

    await expect(
      service.testConnection({
        tenantId: "t1",
        userId: "u1",
        restrictedToOwnSite: true,
        routerId: "r1",
      }),
    ).rejects.toThrow("Akses ditolak");
    expect(mocks.testRouterConnection).not.toHaveBeenCalled();
  });

  it("admin tenant hanya memicu ping tenant-nya, bukan seluruh tenant", async () => {
    const count = await serviceWith({}).checkRouterStatus({
      tenantId: "t1",
      userId: "u1",
      isSuperAdmin: false,
      restrictedToOwnSite: false,
    });

    expect(count).toBe(3);
    expect(mocks.checkAll).not.toHaveBeenCalled();
    expect(mocks.checkTenant).toHaveBeenCalledWith({ tenantId: "t1" });
  });

  it("admin mikrotik:site_only hanya site-nya; tanpa site tidak ada yang dicek", async () => {
    await serviceWith({ userSiteId: "site-a" }).checkRouterStatus({
      tenantId: "t1",
      userId: "u1",
      isSuperAdmin: false,
      restrictedToOwnSite: true,
    });
    expect(mocks.checkTenant).toHaveBeenCalledWith({
      tenantId: "t1",
      siteId: "site-a",
    });

    mocks.checkTenant.mockClear();
    const count = await serviceWith({ userSiteId: null }).checkRouterStatus({
      tenantId: "t1",
      userId: "u1",
      isSuperAdmin: false,
      restrictedToOwnSite: true,
    });
    expect(count).toBe(0);
    expect(mocks.checkTenant).not.toHaveBeenCalled();
  });

  it("super admin tetap memicu ping global", async () => {
    await expect(
      serviceWith({}).checkRouterStatus({
        tenantId: null,
        userId: "u1",
        isSuperAdmin: true,
        restrictedToOwnSite: false,
      }),
    ).resolves.toBe(99);
  });
});
