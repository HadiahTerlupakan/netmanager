import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/database", () => ({ prisma: {} }));

import { StockOpnameJadwalRepository } from "@/modules/inventory/repositories/StockOpnameJadwalRepository";

describe("StockOpnameJadwalRepository.findSiteIdsPengguna", () => {
  it("menyaring tenant dan menggabungkan site utama dengan UserSite tanpa duplikat", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      siteId: "s1",
      userSites: [{ siteId: "s1" }, { siteId: "s2" }],
    });
    const repository = new StockOpnameJadwalRepository({
      user: { findFirst },
    } as never);

    expect(await repository.findSiteIdsPengguna("t-1", "u-1")).toEqual([
      "s1",
      "s2",
    ]);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u-1", tenantId: "t-1" } }),
    );
  });

  it("mengembalikan daftar kosong bila pengguna bukan milik tenant", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new StockOpnameJadwalRepository({
      user: { findFirst },
    } as never);

    expect(await repository.findSiteIdsPengguna("t-1", "u-lain")).toEqual([]);
  });
});

describe("StockOpnameJadwalRepository.findPenggunaDenganIzin", () => {
  function pengguna(
    id: string,
    izin: Array<[string, string]>,
    opsi: {
      siteId?: string | null;
      userSites?: string[];
      name?: string;
      isSuperAdmin?: boolean;
    } = {},
  ) {
    return {
      id,
      siteId: opsi.siteId ?? null,
      userSites: (opsi.userSites ?? []).map((siteId) => ({ siteId })),
      role: {
        name: opsi.name ?? "Petugas Gudang",
        isSuperAdmin: opsi.isSuperAdmin ?? false,
        permission: izin.map(([resource, action]) => ({ resource, action })),
      },
    };
  }

  function repositoryDengan(users: unknown[]) {
    const findMany = vi.fn().mockResolvedValue(users);
    return {
      findMany,
      repository: new StockOpnameJadwalRepository({
        user: { findMany },
      } as never),
    };
  }

  it("menyaring tenant & izin aksi, dan membaca ketiga izin pembatas opname", async () => {
    const { findMany, repository } = repositoryDengan([]);

    await repository.findPenggunaDenganIzin("t-1", "create");

    const argumen = findMany.mock.calls[0][0];
    expect(argumen.where).toEqual({
      tenantId: "t-1",
      isActive: true,
      role: { permission: { some: { resource: "opname", action: "create" } } },
    });
    expect(argumen.select.role.select.permission.where.OR).toEqual([
      { resource: "opname", action: "site_only" },
      { resource: "barang", action: "site_only" },
      { resource: "gudang", action: "site_only" },
    ]);
  });

  it("mengembalikan data mentah: site gabungan, data role, dan izin pembatas role", async () => {
    const { repository } = repositoryDengan([
      pengguna("u-1", [["gudang", "site_only"]], {
        siteId: "s1",
        userSites: ["s1", "s2"],
        name: "SUPER_ADMIN",
        isSuperAdmin: true,
      }),
      pengguna("u-2", []),
    ]);

    expect(await repository.findPenggunaDenganIzin("t-1", "create")).toEqual([
      {
        id: "u-1",
        siteIds: ["s1", "s2"],
        namaRole: "SUPER_ADMIN",
        isRoleSuperAdmin: true,
        izinPembatasRole: ["gudang:site_only"],
      },
      {
        id: "u-2",
        siteIds: [],
        namaRole: "Petugas Gudang",
        isRoleSuperAdmin: false,
        izinPembatasRole: [],
      },
    ]);
  });

  it("pengguna tanpa role menghasilkan data role kosong", async () => {
    const { repository } = repositoryDengan([
      { id: "u-1", siteId: null, userSites: [], role: null },
    ]);

    expect(await repository.findPenggunaDenganIzin("t-1", "create")).toEqual([
      {
        id: "u-1",
        siteIds: [],
        namaRole: null,
        isRoleSuperAdmin: false,
        izinPembatasRole: [],
      },
    ]);
  });

  it("tenant kosong tidak pernah menjalankan query lintas tenant", async () => {
    const { findMany, repository } = repositoryDengan([pengguna("u-1", [])]);

    expect(await repository.findPenggunaDenganIzin("", "create")).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
