import { describe, expect, it, vi } from "vitest";

import { InventoryBarangRouteService } from "@/modules/inventory";

const barang = {
  id: "barang-1",
  kode: "BRG-1",
  nama: "Kabel",
  satuan: "meter",
  barangGudang: [
    { stok: 3, gudang: { sites: [{ id: "site-1" }] } },
    { stok: 5, gudang: { sites: [{ id: "site-2" }] } },
  ],
};

describe("InventoryBarangRouteService", () => {
  it("mengambil detail barang dan menghitung stok sesuai site", async () => {
    const repository = {
      findBarangDetail: vi.fn().mockResolvedValue(barang),
    };
    const service = new InventoryBarangRouteService(repository as never);

    const result = await service.getBarangDetail({
      id: "barang-1",
      siteId: "site-1",
    });

    expect(repository.findBarangDetail).toHaveBeenCalledWith("barang-1");
    expect(result).toEqual({
      found: true,
      barang: {
        ...barang,
        barangGudang: [barang.barangGudang[0]],
        totalStock: 3,
      },
    });
  });

  it("menolak update barang ketika kode sudah dipakai barang lain", async () => {
    const repository = {
      findBarangById: vi.fn().mockResolvedValue(barang),
      findBarangByKode: vi.fn().mockResolvedValue({ id: "barang-2" }),
      updateBarang: vi.fn(),
    };
    const service = new InventoryBarangRouteService(repository as never);

    const result = await service.updateBarang({
      id: "barang-1",
      siteId: undefined,
      body: { kode: "BRG-2", nama: "Kabel", satuan: "meter" },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Kode barang sudah digunakan",
    });
    expect(repository.updateBarang).not.toHaveBeenCalled();
  });

  it("mengambil list barang dengan site restriction yang dihitung dari permission", async () => {
    const repository = {};
    const inventoryBarangService = {
      listBarang: vi.fn().mockResolvedValue({
        barangs: [{ id: "barang-1" }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    };
    const inventoryRouteService = {
      getUserSiteId: vi.fn().mockResolvedValue("site-1"),
    };
    const service = new InventoryBarangRouteService(
      repository as never,
      inventoryBarangService as never,
      inventoryRouteService as never,
    );

    const result = await service.listBarang({
      userId: "user-1",
      permissions: ["barang:site_only"],
      isSuperAdmin: false,
      search: "kabel",
      gudangId: null,
      page: 1,
      limit: 10,
    });

    expect(inventoryRouteService.getUserSiteId).toHaveBeenCalledWith("user-1");
    expect(inventoryBarangService.listBarang).toHaveBeenCalledWith({
      userId: "user-1",
      search: "kabel",
      gudangId: null,
      page: 1,
      limit: 10,
      siteId: "site-1",
    });
    expect(result).toEqual({
      barangs: [{ id: "barang-1" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it("menolak create barang tanpa nama atau satuan", async () => {
    const repository = {};
    const inventoryBarangService = { createBarang: vi.fn() };
    const service = new InventoryBarangRouteService(
      repository as never,
      inventoryBarangService as never,
    );

    const result = await service.createBarang({
      userId: "user-1",
      body: { nama: "", satuan: "meter" },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Nama dan satuan barang harus diisi",
    });
    expect(inventoryBarangService.createBarang).not.toHaveBeenCalled();
  });

  it("membuat barang setelah body valid", async () => {
    const repository = {};
    const inventoryBarangService = {
      createBarang: vi.fn().mockResolvedValue({ barang: { id: "barang-1" } }),
    };
    const service = new InventoryBarangRouteService(
      repository as never,
      inventoryBarangService as never,
    );

    const result = await service.createBarang({
      userId: "user-1",
      body: { nama: "Kabel", satuan: "meter", kode: "BRG-1" },
    });

    expect(inventoryBarangService.createBarang).toHaveBeenCalledWith({
      userId: "user-1",
      kode: "BRG-1",
      nama: "Kabel",
      satuan: "meter",
      isWorkOrderMaterial: undefined,
      jenis: undefined,
      kategoriAset: undefined,
      minStokDefault: undefined,
    });
    expect(result).toEqual({
      success: true,
      data: { barang: { id: "barang-1" } },
      message: "Barang berhasil dibuat",
    });
  });

  it("menghapus barang setelah lolos validasi akses site", async () => {
    const repository = {
      findBarangById: vi.fn().mockResolvedValue(barang),
      deleteBarang: vi.fn().mockResolvedValue(undefined),
    };
    const service = new InventoryBarangRouteService(repository as never);

    const result = await service.deleteBarang({
      id: "barang-1",
      siteId: "site-1",
    });

    expect(repository.deleteBarang).toHaveBeenCalledWith("barang-1");
    expect(result).toEqual({
      success: true,
      data: null,
      message: "Barang berhasil dihapus",
    });
  });
});
