import { describe, expect, it, vi } from "vitest";

import { lingkupKelolaSite, SiteService } from "@/modules/roles";

/**
 * Pemegang `site:site_only` hanya boleh membaca dan mengelola site-nya sendiri.
 * Dulu detail/ubah/hapus site tidak membaca pembatasan sama sekali, dan daftar
 * site jatuh ke "semua site" untuk pengguna dibatasi yang belum punya site.
 */

const siteEntity = {
  id: "site-2",
  code: "BDG",
  name: "Bandung",
  description: null as string | null,
  address: null as string | null,
  kabupatenKota: null as string | null,
  isActive: true,
  location: {
    latitude: null as number | null,
    longitude: null as number | null,
    attendanceRadius: 100,
  },
  counts: { users: 0, workOrders: 0, pelanggan: 0 },
  users: [] as { id: string; name: string }[],
  gudangs: [] as { id: string; nama: string; kode: string }[],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const repositoryPalsu = () => ({
  findAll: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(siteEntity),
  findByCode: vi.fn().mockResolvedValue(null),
  findWithCounts: vi.fn().mockResolvedValue(siteEntity),
  findGudangIdsInTenant: vi.fn().mockResolvedValue([]),
  findGudangIdsDiSites: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockResolvedValue(siteEntity),
  deactivate: vi.fn(),
  delete: vi.fn(),
});

const DIBATASI_SITE_1 = { dibatasi: true, siteIds: ["site-1"] } as const;
const DIBATASI_TANPA_SITE = { dibatasi: true, siteIds: [] } as const;

describe("SiteService — lingkup site:site_only", () => {
  it("site di luar lingkup dijawab NOT_FOUND tanpa membaca atau menulis", async () => {
    const repository = repositoryPalsu();
    const service = new SiteService(repository as never);

    const detail = await service.getSiteById("site-2", DIBATASI_SITE_1);
    const ubah = await service.updateSite(
      "site-2",
      { name: "Bandung Baru" },
      "u-1",
      DIBATASI_SITE_1,
    );
    const hapus = await service.deleteSite("site-2", "u-1", DIBATASI_SITE_1);

    for (const hasil of [detail, ubah, hapus]) {
      expect(hasil).toMatchObject({ success: false, code: "NOT_FOUND" });
    }
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.deactivate).not.toHaveBeenCalled();
  });

  it("site di dalam lingkup tetap bisa dibuka", async () => {
    const repository = repositoryPalsu();
    const service = new SiteService(repository as never);

    const detail = await service.getSiteById("site-2", {
      dibatasi: true,
      siteIds: ["site-1", "site-2"],
    });

    expect(detail.success).toBe(true);
    expect(repository.findById).toHaveBeenCalledWith("site-2");
  });

  it("tidak bisa menautkan gudang site lain ke site sendiri (melebarkan lingkup)", async () => {
    const repository = repositoryPalsu();
    repository.findGudangIdsInTenant.mockResolvedValue(["g-1", "g-site-b"]);
    repository.findGudangIdsDiSites.mockResolvedValue(["g-1"]);
    const service = new SiteService(repository as never);

    const hasil = await service.updateSite(
      "site-1",
      { gudangIds: ["g-1", "g-site-b"] },
      "u-1",
      DIBATASI_SITE_1,
    );

    expect(hasil).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(repository.findGudangIdsDiSites).toHaveBeenCalledWith(
      ["g-1", "g-site-b"],
      ["site-1"],
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("gudang yang sudah di lingkup boleh; tanpa batas tidak dicek lingkupnya", async () => {
    const repository = repositoryPalsu();
    repository.findGudangIdsInTenant.mockResolvedValue(["g-1"]);
    repository.findGudangIdsDiSites.mockResolvedValue(["g-1"]);
    const service = new SiteService(repository as never);

    const dibatasi = await service.updateSite(
      "site-1",
      { gudangIds: ["g-1"] },
      "u-1",
      DIBATASI_SITE_1,
    );
    expect(dibatasi.success).toBe(true);

    repository.findGudangIdsDiSites.mockClear();
    const bebas = await service.updateSite(
      "site-1",
      { gudangIds: ["g-1"] },
      "u-1",
    );
    expect(bebas.success).toBe(true);
    expect(repository.findGudangIdsDiSites).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledTimes(2);
  });

  it("daftar site dibatasi ke site pengguna; dibatasi tanpa site = kosong", async () => {
    const repository = repositoryPalsu();
    const service = new SiteService(repository as never);

    await service.getSites({ activeOnly: true }, DIBATASI_SITE_1);
    expect(repository.findAll).toHaveBeenCalledWith({
      activeOnly: true,
      allowedSiteIds: ["site-1"],
    });

    repository.findAll.mockClear();
    const kosong = await service.getSites({}, DIBATASI_TANPA_SITE);
    expect(kosong).toEqual({ success: true, data: [] });
    expect(repository.findAll).not.toHaveBeenCalled();

    await service.getSites({ search: "bdg" });
    expect(repository.findAll).toHaveBeenCalledWith({
      search: "bdg",
      allowedSiteIds: undefined,
    });
  });
});

describe("lingkupKelolaSite", () => {
  it("hanya site:site_only yang persis yang membatasi; wildcard & super admin bebas", () => {
    const user = { role: "Kepala Site", siteIds: ["site-1"] };

    expect(
      lingkupKelolaSite({ user, permissions: ["site:read", "site:site_only"] }),
    ).toEqual({ dibatasi: true, siteIds: ["site-1"] });
    expect(lingkupKelolaSite({ user, permissions: ["*"] })).toEqual({
      dibatasi: false,
    });
    expect(
      lingkupKelolaSite({
        user: { ...user, isSuperAdmin: true },
        permissions: ["site:site_only"],
      }),
    ).toEqual({ dibatasi: false });
  });

  it("jatuh ke siteId legacy, dan tanpa site sama sekali menjadi lingkup kosong", () => {
    expect(
      lingkupKelolaSite({
        user: { siteId: "site-9", siteIds: [] },
        permissions: ["site:site_only"],
      }),
    ).toEqual({ dibatasi: true, siteIds: ["site-9"] });
    expect(
      lingkupKelolaSite({ user: {}, permissions: ["site:site_only"] }),
    ).toEqual({ dibatasi: true, siteIds: [] });
  });
});

const prismaSites = vi.hoisted(() => ({
  findMany: vi.fn().mockResolvedValue([]),
}));
const prismaGudang = vi.hoisted(() => ({
  findMany: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { sites: prismaSites, gudang: prismaGudang },
}));

describe("SiteRepository.findGudangIdsDiSites", () => {
  it("hanya gudang yang tertaut ke site di lingkup; lingkup kosong tanpa query", async () => {
    const { SiteRepository } =
      await import("@/modules/roles/repositories/SiteRepository");
    prismaGudang.findMany.mockResolvedValue([{ id: "g-1" }]);
    const repository = new SiteRepository();

    expect(
      await repository.findGudangIdsDiSites(["g-1", "g-2"], ["site-1"]),
    ).toEqual(["g-1"]);
    expect(prismaGudang.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["g-1", "g-2"] },
        sites: { some: { id: { in: ["site-1"] } } },
      },
      select: { id: true },
    });

    prismaGudang.findMany.mockClear();
    expect(await repository.findGudangIdsDiSites(["g-1"], [])).toEqual([]);
    expect(prismaGudang.findMany).not.toHaveBeenCalled();
  });
});

describe("SiteRepository.findAll — allowedSiteIds", () => {
  it("allowedSiteIds kosong tidak cocok dengan site mana pun, bukan semua site", async () => {
    const { SiteRepository } =
      await import("@/modules/roles/repositories/SiteRepository");

    await new SiteRepository().findAll({ allowedSiteIds: [] });

    expect(prismaSites.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [] } } }),
    );
  });
});
