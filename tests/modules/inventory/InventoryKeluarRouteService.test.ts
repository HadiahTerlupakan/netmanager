import { describe, expect, it, vi } from "vitest";

import { InventoryKeluarRouteService } from "@/modules/inventory";

const keluar = { id: "keluar-1", barangId: "barang-1", gudangId: "gudang-1" };

function createService() {
  const repository = {
    getHistoryKeluar: vi.fn().mockResolvedValue({ items: [keluar], total: 1 }),
    getStockBreakdown: vi
      .fn()
      .mockResolvedValue({ baru: 2, bekas: 3, rusak: 0, total: 5 }),
    removeStock: vi.fn().mockResolvedValue(keluar),
    getStockLevel: vi.fn().mockResolvedValue(4),
  };
  const inventoryRouteService = {
    resolveRestrictedSiteId: vi.fn().mockResolvedValue("site-1"),
  };

  return {
    repository,
    inventoryRouteService,
    service: new InventoryKeluarRouteService(
      repository as never,
      inventoryRouteService as never,
    ),
  };
}

describe("InventoryKeluarRouteService", () => {
  it("mengambil histori keluar dengan site restriction", async () => {
    const { repository, service } = createService();

    const result = await service.listKeluar({
      userId: "user-1",
      permissions: ["keluar:site_only"],
      isSuperAdmin: false,
      page: 1,
      limit: 20,
      barangId: "barang-1",
    });

    expect(repository.getHistoryKeluar).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      barangId: "barang-1",
      siteId: "site-1",
    });
    expect(result).toEqual({
      keluarList: [keluar],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("mengambil stok per kondisi untuk checkStock", async () => {
    const { repository, service } = createService();

    const result = await service.getStockBreakdown("barang-1", "gudang-1");

    expect(repository.getStockBreakdown).toHaveBeenCalledWith(
      "barang-1",
      "gudang-1",
    );
    expect(result).toEqual({
      stokByKondisi: { BARU: 2, BEKAS: 3, RUSAK: 0, total: 5 },
    });
  });

  it("menolak create keluar dengan jumlah invalid", async () => {
    const { repository, service } = createService();

    const result = await service.createKeluar({
      userId: "user-1",
      body: { barangId: "barang-1", gudangId: "gudang-1", jumlah: 0 },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Barang, gudang, dan jumlah harus diisi dengan benar",
    });
    expect(repository.removeStock).not.toHaveBeenCalled();
  });

  it("mencatat barang keluar setelah body valid", async () => {
    const { repository, service } = createService();

    const result = await service.createKeluar({
      userId: "user-1",
      body: {
        barangId: "barang-1",
        gudangId: "gudang-1",
        jumlah: 2,
        kondisi: "RUSAK",
        isHilang: true,
      },
    });

    expect(repository.removeStock).toHaveBeenCalledWith({
      barangId: "barang-1",
      gudangId: "gudang-1",
      jumlah: 2,
      kondisi: "RUSAK",
      tujuanPenggunaan: undefined,
      keterangan: undefined,
      isHilang: true,
      fotoBukti: [],
      fotoMetadata: null,
      tanggal: expect.any(Date),
      userId: "user-1",
    });
    expect(result).toEqual({
      success: true,
      data: { keluarRecord: keluar, finalStock: 4, parsedJumlah: 2 },
    });
  });
});
