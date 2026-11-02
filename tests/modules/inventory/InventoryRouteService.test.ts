import { beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryRouteService } from "@/modules/inventory";
import { prismaMock } from "../../setup";

const IZIN_GUDANG = ["barang:site_only", "gudang:site_only"];

function mockUserSites(
  user: { siteId: string | null; userSites: Array<{ siteId: string }> } | null,
) {
  vi.mocked(prismaMock.user.findUnique).mockResolvedValue(user as never);
}

function createService(repositoryOverrides: Record<string, unknown> = {}) {
  const repository = {
    findInventoryStats: vi.fn().mockResolvedValue({ totalGudang: 0 }),
    findOpnameSummary: vi.fn().mockResolvedValue([]),
    findOpnameReport: vi.fn().mockResolvedValue([]),
    findPurchaseRequestById: vi.fn(),
    ...repositoryOverrides,
  };

  return {
    repository,
    service: new InventoryRouteService(repository as never),
  };
}

const PENGGUNA_DIBATASI = {
  userId: "user-1",
  permissions: ["gudang:site_only"],
  isSuperAdmin: false,
};

describe("InventoryRouteService — lingkup site", () => {
  beforeEach(() => {
    vi.mocked(prismaMock.user.findUnique).mockReset();
    vi.mocked(prismaMock.gudang.findFirst).mockReset();
  });

  it("menggabungkan site utama dan userSites ketika permission inventory dibatasi site", async () => {
    mockUserSites({ siteId: "site-1", userSites: [{ siteId: "site-2" }] });
    const { service } = createService();

    const lingkup = await service.resolveLingkupSite({
      ...PENGGUNA_DIBATASI,
      restrictedPermissions: IZIN_GUDANG,
    });

    expect(lingkup).toEqual({ dibatasi: true, siteIds: ["site-1", "site-2"] });
  });

  it("tidak membaca site ketika user super admin", async () => {
    const { service } = createService();

    const lingkup = await service.resolveLingkupSite({
      ...PENGGUNA_DIBATASI,
      isSuperAdmin: true,
      restrictedPermissions: IZIN_GUDANG,
    });

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(lingkup).toEqual({ dibatasi: false });
  });

  it("tanpa permission pembatas endpoint, user tidak dibatasi", async () => {
    const { service } = createService();

    const lingkup = await service.resolveLingkupSite({
      ...PENGGUNA_DIBATASI,
      permissions: ["masuk:site_only"],
      restrictedPermissions: IZIN_GUDANG,
    });

    expect(lingkup).toEqual({ dibatasi: false });
  });

  it("statistik user dibatasi tanpa site gagal-tertutup (siteIds kosong)", async () => {
    mockUserSites({ siteId: null, userSites: [] });
    const { repository, service } = createService();

    await service.getInventoryStats({
      pengguna: PENGGUNA_DIBATASI,
      startOfDay: new Date(),
    });

    expect(repository.findInventoryStats).toHaveBeenCalledWith(
      expect.objectContaining({ siteIds: [] }),
    );
  });

  it("statistik user tidak dibatasi tidak memakai saringan site", async () => {
    const { repository, service } = createService();

    await service.getInventoryStats({
      pengguna: { ...PENGGUNA_DIBATASI, permissions: [] },
      startOfDay: new Date(),
    });

    expect(repository.findInventoryStats).toHaveBeenCalledWith(
      expect.objectContaining({ siteIds: undefined }),
    );
  });

  it("ringkasan dan laporan opname tanpa gudangId dibatasi ke site user", async () => {
    mockUserSites({ siteId: "site-1", userSites: [] });
    const { repository, service } = createService();
    const pengguna = {
      ...PENGGUNA_DIBATASI,
      permissions: ["opname:site_only"],
    };

    await service.getOpnameSummary({ pengguna });
    await service.getOpnameReport({ pengguna });

    expect(repository.findOpnameSummary).toHaveBeenCalledWith({
      gudangId: undefined,
      siteIds: ["site-1"],
    });
    expect(repository.findOpnameReport).toHaveBeenCalledWith({
      gudangId: undefined,
      siteIds: ["site-1"],
    });
  });

  it("menolak pengajuan restock yang gudangnya di site lain", async () => {
    mockUserSites({ siteId: "site-1", userSites: [] });
    vi.mocked(prismaMock.gudang.findFirst).mockResolvedValue(null);
    const { service } = createService({
      findPurchaseRequestById: vi
        .fn()
        .mockResolvedValue({ id: "pr-1", gudangId: "gudang-lain" }),
    });

    const boleh = await service.canAccessPurchaseRequest({
      ...PENGGUNA_DIBATASI,
      permissions: ["restock:site_only"],
      id: "pr-1",
      tenantId: "tenant-1",
    });

    expect(boleh).toBe(false);
    expect(prismaMock.gudang.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "gudang-lain",
          sites: { some: { id: { in: ["site-1"] } } },
        },
      }),
    );
  });

  it("pengajuan restock yang tidak ada diserahkan ke route untuk 404", async () => {
    const { service } = createService({
      findPurchaseRequestById: vi.fn().mockResolvedValue(null),
    });

    const boleh = await service.canAccessPurchaseRequest({
      ...PENGGUNA_DIBATASI,
      permissions: ["restock:site_only"],
      id: "pr-hilang",
      tenantId: "tenant-1",
    });

    expect(boleh).toBe(true);
  });
});
