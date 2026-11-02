import { describe, expect, it, vi } from "vitest";

import { InventoryGudangRouteService } from "@/modules/inventory";

const gudang = {
  id: "gudang-1",
  kode: "GD001",
  nama: "Gudang Utama",
};

const PENGGUNA = {
  userId: "user-1",
  permissions: ["gudang:site_only"],
  isSuperAdmin: false,
};

function createService() {
  const repository = {
    getAllGudang: vi.fn().mockResolvedValue([gudang]),
    createGudang: vi.fn().mockResolvedValue(gudang),
    findGudangById: vi.fn().mockResolvedValue({ ...gudang, isActive: true }),
    findGudangByKode: vi.fn().mockResolvedValue(null),
    updateGudang: vi.fn().mockResolvedValue({ ...gudang, lokasi: "Bandung" }),
    hasStockInGudang: vi.fn().mockResolvedValue(false),
    deleteGudang: vi.fn().mockResolvedValue(undefined),
  };
  const inventoryRouteService = {
    resolveLingkupSite: vi
      .fn()
      .mockResolvedValue({ dibatasi: true, siteIds: ["site-1"] }),
    canAccessGudang: vi.fn().mockResolvedValue(true),
  };
  const createCode = vi.fn().mockReturnValue("GD123456001");

  return {
    repository,
    inventoryRouteService,
    createCode,
    service: new InventoryGudangRouteService(
      repository as never,
      inventoryRouteService as never,
      createCode,
    ),
  };
}

describe("InventoryGudangRouteService", () => {
  it("mengambil gudang dengan filter site ketika user dibatasi", async () => {
    const { repository, inventoryRouteService, service } = createService();

    const result = await service.listGudang({
      userId: "user-1",
      permissions: ["gudang:site_only"],
      isSuperAdmin: false,
      viewAll: false,
    });

    expect(inventoryRouteService.resolveLingkupSite).toHaveBeenCalledWith({
      userId: "user-1",
      permissions: ["gudang:site_only"],
      isSuperAdmin: false,
      restrictedPermissions: ["barang:site_only", "gudang:site_only"],
    });
    expect(repository.getAllGudang).toHaveBeenCalledWith({
      siteIds: ["site-1"],
    });
    expect(result).toEqual([gudang]);
  });

  it("tidak meminta gudang nonaktif untuk pemilih gudang biasa", async () => {
    const { repository, service } = createService();

    await service.listGudang({
      userId: "user-1",
      permissions: ["gudang:site_only"],
      isSuperAdmin: false,
      viewAll: false,
    });

    expect(repository.getAllGudang).toHaveBeenCalledWith({
      siteIds: ["site-1"],
    });
  });

  it("menyertakan gudang nonaktif saat layar manajemen memintanya", async () => {
    // Tanpa ini, menonaktifkan gudang membuatnya lenyap dari daftar dan
    // mustahil diaktifkan lagi lewat antarmuka.
    const { repository, service } = createService();

    await service.listGudang({
      userId: "user-1",
      permissions: ["gudang:site_only"],
      isSuperAdmin: false,
      viewAll: false,
      includeInactive: true,
    });

    expect(repository.getAllGudang).toHaveBeenCalledWith({
      siteIds: ["site-1"],
      includeInactive: true,
    });
  });

  it("menolak create gudang tanpa nama", async () => {
    const { repository, service } = createService();

    const result = await service.createGudang({
      userId: "user-1",
      permissions: [],
      isSuperAdmin: false,
      body: {},
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error:
        "Nama gudang belum diisi. Tulis nama gudangnya, contoh: Gudang Utama.",
      details: {
        nama: [
          "Nama gudang belum diisi. Tulis nama gudangnya, contoh: Gudang Utama.",
        ],
      },
    });
    expect(repository.createGudang).not.toHaveBeenCalled();
  });

  it("membuat gudang dengan site user ketika restricted", async () => {
    const { repository, service } = createService();

    const result = await service.createGudang({
      userId: "user-1",
      permissions: ["gudang:site_only"],
      isSuperAdmin: false,
      body: { nama: "Gudang Utama", lokasi: "Jakarta", siteIds: ["site-2"] },
    });

    expect(repository.createGudang).toHaveBeenCalledWith({
      kode: "GD123456001",
      nama: "Gudang Utama",
      isActive: true,
      lokasi: "Jakarta",
      siteIds: ["site-1"],
    });
    expect(result).toEqual({ success: true, data: gudang });
  });

  it("membuat gudang di site yang dipilih bila masih dalam lingkup user", async () => {
    const { repository, inventoryRouteService, service } = createService();
    inventoryRouteService.resolveLingkupSite.mockResolvedValue({
      dibatasi: true,
      siteIds: ["site-1", "site-2"],
    });

    await service.createGudang({
      ...PENGGUNA,
      body: { nama: "Gudang Dua", siteIds: ["site-2", "site-luar"] },
    });

    expect(repository.createGudang).toHaveBeenCalledWith(
      expect.objectContaining({ siteIds: ["site-2"] }),
    );
  });

  it("user dibatasi tanpa site tidak bisa membuat gudang", async () => {
    const { repository, inventoryRouteService, service } = createService();
    inventoryRouteService.resolveLingkupSite.mockResolvedValue({
      dibatasi: true,
      siteIds: [],
    });

    const result = await service.createGudang({
      ...PENGGUNA,
      body: { nama: "Gudang Utama" },
    });

    expect(result).toMatchObject({ success: false, status: 403 });
    expect(repository.createGudang).not.toHaveBeenCalled();
  });

  it("user dibatasi tanpa site mendapat daftar gudang kosong", async () => {
    const { repository, inventoryRouteService, service } = createService();
    inventoryRouteService.resolveLingkupSite.mockResolvedValue({
      dibatasi: true,
      siteIds: [],
    });

    await service.listGudang({ ...PENGGUNA, viewAll: false });

    expect(repository.getAllGudang).toHaveBeenCalledWith({ siteIds: [] });
  });

  it("mengambil detail gudang setelah lingkup site tervalidasi", async () => {
    const { repository, inventoryRouteService, service } = createService();

    const result = await service.getGudangDetail({
      id: "gudang-1",
      pengguna: PENGGUNA,
    });

    expect(repository.findGudangById).toHaveBeenCalledWith("gudang-1");
    expect(inventoryRouteService.canAccessGudang).toHaveBeenCalledWith({
      ...PENGGUNA,
      gudangId: "gudang-1",
      restrictedPermissions: ["barang:site_only", "gudang:site_only"],
    });
    expect(result).toEqual({
      success: true,
      data: { ...gudang, isActive: true },
    });
  });

  it.each(["detail", "update", "delete"] as const)(
    "menolak %s gudang site lain dengan 403",
    async (aksi) => {
      const { repository, inventoryRouteService, service } = createService();
      inventoryRouteService.canAccessGudang.mockResolvedValue(false);
      const input = { id: "gudang-1", pengguna: PENGGUNA };

      const result =
        aksi === "detail"
          ? await service.getGudangDetail(input)
          : aksi === "update"
            ? await service.updateGudang({
                ...input,
                body: { kode: "GD001", nama: "Gudang" },
              })
            : await service.deleteGudang(input);

      expect(result).toMatchObject({ success: false, status: 403 });
      expect(repository.updateGudang).not.toHaveBeenCalled();
      expect(repository.deleteGudang).not.toHaveBeenCalled();
    },
  );

  it("menolak update gudang ketika kode dipakai gudang lain", async () => {
    const { repository, service } = createService();
    repository.findGudangByKode.mockResolvedValue({
      id: "gudang-2",
      nama: "Gudang Timur",
    });

    const result = await service.updateGudang({
      id: "gudang-1",
      pengguna: PENGGUNA,
      body: { kode: "GD002", nama: "Gudang Dua" },
    });

    expect(result).toEqual({
      success: false,
      status: 409,
      error:
        'Kode gudang "GD002" sudah dipakai gudang "Gudang Timur". Pakai kode lain.',
    });
    expect(repository.updateGudang).not.toHaveBeenCalled();
  });

  it("menolak hapus gudang yang masih memiliki stok", async () => {
    const { repository, service } = createService();
    repository.hasStockInGudang.mockResolvedValue(true);
    repository.findGudangById.mockResolvedValue({
      ...gudang,
      isActive: true,
      barangGudang: [{ stok: 10 }, { stok: 0 }, { stok: 35 }],
    });

    const result = await service.deleteGudang({
      id: "gudang-1",
      pengguna: PENGGUNA,
    });

    expect(result).toEqual({
      success: false,
      status: 409,
      error:
        'Gudang "Gudang Utama" tidak bisa dihapus karena masih ada 2 jenis barang di dalamnya (total stok 45). Keluarkan atau pindahkan semua barangnya ke gudang lain dulu, baru hapus gudangnya.',
    });
    expect(repository.deleteGudang).not.toHaveBeenCalled();
  });
});
