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
import {
  resolveCreateSiteId,
  resolveUpdateSiteId,
} from "@/modules/network/services/mikrotik-router.payloads";

function serviceWith(opts: {
  router?: { id: string; siteId: string | null } | null;
  userSiteId?: string | null;
  userSiteIds?: string[];
}) {
  const routerRepository = {
    findById: vi.fn().mockResolvedValue(opts.router ?? null),
    findWithFilters: vi.fn().mockResolvedValue({
      routers: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    }),
  };
  const networkRepository = userSiteRepository(opts);
  const service = new MikroTikRouterService(
    routerRepository as never,
    networkRepository as never,
  );
  return Object.assign(service, { fakeRouters: routerRepository });
}

function userSiteRepository(opts: {
  userSiteId?: string | null;
  userSiteIds?: string[];
}) {
  return {
    findUserSite: vi.fn().mockResolvedValue({
      siteId: opts.userSiteId ?? null,
      siteIds: opts.userSiteIds ?? [],
    }),
  };
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
      siteIds: ["site-a"],
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

// Regresi: lingkup `mikrotik:site_only` dulu hanya membaca `User.siteId`
// legacy. Pengguna multi-site (`userSites`) tidak bisa melihat/mengelola
// router di site tambahannya, dan create memaksa router ke site legacy.
describe("MikroTikRouterService — lingkup multi-site (userSites)", () => {
  const multiSite = { userSiteId: "site-a", userSiteIds: ["site-a", "site-b"] };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkTenant.mockResolvedValue(2);
  });

  it("detail router di site tambahan diizinkan", async () => {
    const service = serviceWith({
      ...multiSite,
      router: { id: "r1", siteId: "site-b" },
    });

    await expect(
      service.getRouterById({
        id: "r1",
        tenantId: "t1",
        userId: "u1",
        restrictedToOwnSite: true,
      }),
    ).resolves.toMatchObject({ id: "r1" });
  });

  it("detail router di luar seluruh site pengguna ditolak", async () => {
    const service = serviceWith({
      ...multiSite,
      router: { id: "r1", siteId: "site-z" },
    });

    await expect(
      service.getRouterById({
        id: "r1",
        tenantId: "t1",
        userId: "u1",
        restrictedToOwnSite: true,
      }),
    ).rejects.toThrow("Akses ditolak");
  });

  it("router tanpa site ditolak bagi pengguna terbatas", async () => {
    const service = serviceWith({
      ...multiSite,
      router: { id: "r1", siteId: null },
    });

    await expect(
      service.getRouterById({
        id: "r1",
        tenantId: "t1",
        userId: "u1",
        restrictedToOwnSite: true,
      }),
    ).rejects.toThrow("Akses ditolak");
  });

  it("pengguna terbatas tanpa site sama sekali ditolak (gagal tertutup)", async () => {
    const service = serviceWith({ router: { id: "r1", siteId: "site-a" } });

    await expect(
      service.getRouterById({
        id: "r1",
        tenantId: "t1",
        userId: "u1",
        restrictedToOwnSite: true,
      }),
    ).rejects.toThrow("Akses ditolak");
  });

  it("siteIds kosong jatuh ke siteId legacy", async () => {
    const service = serviceWith({
      userSiteId: "site-a",
      userSiteIds: [],
      router: { id: "r1", siteId: "site-a" },
    });

    await expect(
      service.getRouterById({
        id: "r1",
        tenantId: "t1",
        userId: "u1",
        restrictedToOwnSite: true,
      }),
    ).resolves.toMatchObject({ id: "r1" });
  });

  it("daftar router difilter ke seluruh site pengguna", async () => {
    const service = serviceWith(multiSite);

    await service.listRouters({
      userId: "u1",
      tenantId: "t1",
      restrictedToOwnSite: true,
      page: 1,
      limit: 10,
    });

    expect(service.fakeRouters.findWithFilters).toHaveBeenCalledWith(
      { siteIds: ["site-a", "site-b"] },
      { page: 1, limit: 10 },
      "t1",
    );
  });

  it("daftar router kosong tanpa query bila pengguna terbatas tak punya site", async () => {
    const service = serviceWith({});

    const result = await service.listRouters({
      userId: "u1",
      tenantId: "t1",
      restrictedToOwnSite: true,
      page: 1,
      limit: 10,
    });

    expect(result.routers).toEqual([]);
    expect(service.fakeRouters.findWithFilters).not.toHaveBeenCalled();
  });

  it("daftar router tanpa pembatasan tidak menyaring site", async () => {
    const service = serviceWith(multiSite);

    await service.listRouters({
      userId: "u1",
      tenantId: "t1",
      restrictedToOwnSite: false,
      page: 1,
      limit: 10,
    });

    expect(service.fakeRouters.findWithFilters).toHaveBeenCalledWith(
      {},
      { page: 1, limit: 10 },
      "t1",
    );
  });

  it("cek status meneruskan seluruh site pengguna", async () => {
    await serviceWith(multiSite).checkRouterStatus({
      tenantId: "t1",
      userId: "u1",
      isSuperAdmin: false,
      restrictedToOwnSite: true,
    });

    expect(mocks.checkTenant).toHaveBeenCalledWith({
      tenantId: "t1",
      siteIds: ["site-a", "site-b"],
    });
  });
});

describe("site router saat create/update — lingkup multi-site", () => {
  const multiSite = { userSiteId: "site-a", userSiteIds: ["site-a", "site-b"] };

  it("create: site pilihan yang termasuk site pengguna dipakai", async () => {
    await expect(
      resolveCreateSiteId({
        userId: "u1",
        siteId: "site-b",
        restrictedToOwnSite: true,
        networkRepository: userSiteRepository(multiSite),
      }),
    ).resolves.toBe("site-b");
  });

  it("create: site pilihan di luar site pengguna ditolak", async () => {
    await expect(
      resolveCreateSiteId({
        userId: "u1",
        siteId: "site-z",
        restrictedToOwnSite: true,
        networkRepository: userSiteRepository(multiSite),
      }),
    ).rejects.toThrow("Akses ditolak");
  });

  it("create: tanpa pilihan memakai site utama", async () => {
    await expect(
      resolveCreateSiteId({
        userId: "u1",
        restrictedToOwnSite: true,
        networkRepository: userSiteRepository({
          userSiteId: "site-b",
          userSiteIds: ["site-a", "site-b"],
        }),
      }),
    ).resolves.toBe("site-b");
  });

  it("create: site legacy di luar userSites tidak dipakai sebagai default", async () => {
    await expect(
      resolveCreateSiteId({
        userId: "u1",
        restrictedToOwnSite: true,
        networkRepository: userSiteRepository({
          userSiteId: "site-lama",
          userSiteIds: ["site-a", "site-b"],
        }),
      }),
    ).resolves.toBe("site-a");
  });

  it("create: pengguna terbatas tanpa site ditolak", async () => {
    await expect(
      resolveCreateSiteId({
        userId: "u1",
        restrictedToOwnSite: true,
        networkRepository: userSiteRepository({}),
      }),
    ).rejects.toThrow("User tidak memiliki akses site untuk membuat router");
  });

  it("create: tanpa pembatasan memakai site permintaan apa adanya", async () => {
    const networkRepository = userSiteRepository({});
    await expect(
      resolveCreateSiteId({
        userId: "u1",
        siteId: "site-z",
        restrictedToOwnSite: false,
        networkRepository,
      }),
    ).resolves.toBe("site-z");
    expect(networkRepository.findUserSite).not.toHaveBeenCalled();
  });

  it("update: tanpa siteId site router tidak diubah", async () => {
    await expect(
      resolveUpdateSiteId({
        userId: "u1",
        restrictedToOwnSite: true,
        networkRepository: userSiteRepository(multiSite),
      }),
    ).resolves.toBeUndefined();
  });

  it("update: pindah ke site tambahan pengguna diizinkan", async () => {
    await expect(
      resolveUpdateSiteId({
        userId: "u1",
        siteId: "site-b",
        restrictedToOwnSite: true,
        networkRepository: userSiteRepository(multiSite),
      }),
    ).resolves.toBe("site-b");
  });

  it.each([["site-z"], [null]])(
    "update: pindah ke %s (di luar lingkup) ditolak",
    async (siteId) => {
      await expect(
        resolveUpdateSiteId({
          userId: "u1",
          siteId,
          restrictedToOwnSite: true,
          networkRepository: userSiteRepository(multiSite),
        }),
      ).rejects.toThrow("Akses ditolak");
    },
  );
});
