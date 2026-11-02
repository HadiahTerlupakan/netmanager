import { describe, expect, it, vi } from "vitest";

import { InventoryMasukRouteService } from "@/modules/inventory";

const masuk = { id: "masuk-1", barangId: "barang-1", gudangId: "gudang-1" };

function createService() {
  const repository = {
    getHistoryMasuk: vi.fn().mockResolvedValue({ items: [masuk], total: 1 }),
    addStock: vi.fn().mockResolvedValue(masuk),
    getStockLevel: vi.fn().mockResolvedValue(7),
  };
  const inventoryRouteService = {
    resolveLingkupSite: vi
      .fn()
      .mockResolvedValue({ dibatasi: true, siteIds: ["site-1", "site-2"] }),
  };

  return {
    repository,
    inventoryRouteService,
    service: new InventoryMasukRouteService(
      repository as never,
      inventoryRouteService as never,
    ),
  };
}

describe("InventoryMasukRouteService", () => {
  it("mengambil histori masuk dengan site restriction", async () => {
    const { repository, inventoryRouteService, service } = createService();

    const result = await service.listMasuk({
      userId: "user-1",
      permissions: ["masuk:site_only"],
      isSuperAdmin: false,
      page: 1,
      limit: 20,
      search: "kabel",
    });

    expect(inventoryRouteService.resolveLingkupSite).toHaveBeenCalledWith({
      userId: "user-1",
      permissions: ["masuk:site_only"],
      isSuperAdmin: false,
      restrictedPermissions: [
        "masuk:site_only",
        "barang:site_only",
        "gudang:site_only",
      ],
    });
    expect(repository.getHistoryMasuk).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      search: "kabel",
      siteIds: ["site-1", "site-2"],
    });
    expect(result).toEqual({
      masukList: [masuk],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("user dibatasi tanpa site mendapat daftar kosong, bukan seluruh tenant", async () => {
    const { repository, inventoryRouteService, service } = createService();
    inventoryRouteService.resolveLingkupSite.mockResolvedValue({
      dibatasi: true,
      siteIds: [],
    });

    await service.listMasuk({
      userId: "user-1",
      permissions: ["masuk:site_only"],
      isSuperAdmin: false,
      page: 1,
      limit: 20,
      siteId: "site-lain",
    });

    expect(repository.getHistoryMasuk).toHaveBeenCalledWith(
      expect.objectContaining({ siteIds: [] }),
    );
  });

  it("menolak create masuk dengan jumlah invalid", async () => {
    const { repository, service } = createService();

    const result = await service.createMasuk({
      userId: "user-1",
      body: { barangId: "barang-1", gudangId: "gudang-1", jumlah: 0 },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Jumlah harus lebih dari 0.",
    });
    expect(repository.addStock).not.toHaveBeenCalled();
  });

  it("mencatat barang masuk setelah body valid", async () => {
    const { repository, service } = createService();

    const result = await service.createMasuk({
      userId: "user-1",
      body: {
        barangId: "barang-1",
        gudangId: "gudang-1",
        jumlah: 3,
        kondisi: "BEKAS",
        fotoBukti: ["foto.webp"],
        fotoMetadata: { size: 10 },
      },
    });

    expect(repository.addStock).toHaveBeenCalledWith({
      barangId: "barang-1",
      gudangId: "gudang-1",
      jumlah: 3,
      kondisi: "BEKAS",
      keterangan: undefined,
      userId: "user-1",
      fotoBukti: ["foto.webp"],
      fotoMetadata: { size: 10 },
      tanggal: expect.any(Date),
    });
    expect(repository.getStockLevel).toHaveBeenCalledWith(
      "barang-1",
      "gudang-1",
    );
    expect(result).toEqual({
      success: true,
      data: { masukRecord: masuk, finalStock: 7, parsedJumlah: 3 },
    });
  });
});
