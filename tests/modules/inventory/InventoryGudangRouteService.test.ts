import { describe, expect, it, vi } from "vitest";

import { InventoryGudangRouteService } from "@/modules/inventory";

const gudang = {
  id: "gudang-1",
  kode: "GD001",
  nama: "Gudang Utama",
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
    resolveRestrictedSiteId: vi.fn().mockResolvedValue("site-1"),
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

    expect(inventoryRouteService.resolveRestrictedSiteId).toHaveBeenCalledWith({
      userId: "user-1",
      permissions: ["gudang:site_only"],
      isSuperAdmin: false,
      restrictedPermissions: ["gudang:site_only", "k_barang:site_only"],
    });
    expect(repository.getAllGudang).toHaveBeenCalledWith({ siteId: "site-1" });
    expect(result).toEqual([gudang]);
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
      error: "Nama gudang harus diisi",
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

  it("mengambil detail gudang dari repository", async () => {
    const { repository, service } = createService();

    const result = await service.getGudangDetail("gudang-1");

    expect(repository.findGudangById).toHaveBeenCalledWith("gudang-1");
    expect(result).toEqual({
      found: true,
      gudang: { ...gudang, isActive: true },
    });
  });

  it("menolak update gudang ketika kode dipakai gudang lain", async () => {
    const { repository, service } = createService();
    repository.findGudangByKode.mockResolvedValue({ id: "gudang-2" });

    const result = await service.updateGudang({
      id: "gudang-1",
      body: { kode: "GD002", nama: "Gudang Dua" },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Kode gudang sudah digunakan",
    });
    expect(repository.updateGudang).not.toHaveBeenCalled();
  });

  it("menolak hapus gudang yang masih memiliki stok", async () => {
    const { repository, service } = createService();
    repository.hasStockInGudang.mockResolvedValue(true);

    const result = await service.deleteGudang("gudang-1");

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Tidak dapat menghapus gudang yang masih memiliki stok barang",
    });
    expect(repository.deleteGudang).not.toHaveBeenCalled();
  });
});
