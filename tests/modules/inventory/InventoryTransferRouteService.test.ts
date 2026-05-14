import { describe, expect, it, vi } from "vitest";

import { InventoryTransferRouteService } from "@/modules/inventory";

const transfer = {
  id: "transfer-1",
  kodeTransfer: "TRF-1",
  gudangDari: {
    id: "gudang-1",
    kode: "G1",
    nama: "Gudang 1",
    sites: [{ id: "site-1" }],
  },
  gudangKe: {
    id: "gudang-2",
    kode: "G2",
    nama: "Gudang 2",
    sites: [{ id: "site-1" }],
  },
};

const defaultDetailInput = {
  id: "transfer-1",
  userId: "user-1",
  permissions: ["transfer:site_only"],
  isSuperAdmin: false,
};

function createService() {
  const repository = {
    findAllTransfers: vi
      .fn()
      .mockResolvedValue({ items: [transfer], total: 1 }),
    createTransfer: vi.fn().mockResolvedValue(transfer),
    findTransferById: vi.fn().mockResolvedValue(transfer),
    updateTransfer: vi
      .fn()
      .mockResolvedValue({ ...transfer, keterangan: "update" }),
    deleteTransfer: vi.fn().mockResolvedValue(undefined),
  };
  const inventoryRouteService = {
    resolveRestrictedSiteId: vi.fn().mockResolvedValue("site-1"),
  };

  return {
    repository,
    inventoryRouteService,
    service: new InventoryTransferRouteService(
      repository as never,
      inventoryRouteService as never,
    ),
  };
}

describe("InventoryTransferRouteService", () => {
  it("mengambil daftar transfer dengan site restriction", async () => {
    const { repository, inventoryRouteService, service } = createService();

    const result = await service.listTransfers({
      userId: "user-1",
      permissions: ["transfer:site_only"],
      isSuperAdmin: false,
      page: 2,
      limit: 10,
      barangId: "barang-1",
    });

    expect(inventoryRouteService.resolveRestrictedSiteId).toHaveBeenCalledWith({
      userId: "user-1",
      permissions: ["transfer:site_only"],
      isSuperAdmin: false,
      restrictedPermissions: ["transfer:site_only", "k_barang:site_only"],
    });
    expect(repository.findAllTransfers).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      barangId: "barang-1",
      siteId: "site-1",
    });
    expect(result).toEqual({
      transferList: [transfer],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it("menolak create transfer dengan gudang sama", async () => {
    const { repository, service } = createService();

    const result = await service.createTransfer({
      userId: "user-1",
      body: {
        barangId: "barang-1",
        dariGudangId: "gudang-1",
        keGudangId: "gudang-1",
        jumlah: 1,
      },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Gudang sumber dan tujuan tidak boleh sama",
    });
    expect(repository.createTransfer).not.toHaveBeenCalled();
  });

  it("membuat transfer setelah body valid", async () => {
    const { repository, service } = createService();

    const result = await service.createTransfer({
      userId: "user-1",
      body: {
        barangId: "barang-1",
        dariGudangId: "gudang-1",
        keGudangId: "gudang-2",
        jumlah: 2,
        fotoBukti: ["foto.webp"],
      },
    });

    expect(repository.createTransfer).toHaveBeenCalledWith({
      barangId: "barang-1",
      dariGudangId: "gudang-1",
      keGudangId: "gudang-2",
      jumlah: 2,
      kondisi: undefined,
      keterangan: undefined,
      userId: "user-1",
      fotoBukti: ["foto.webp"],
      fotoMetadata: undefined,
    });
    expect(result).toEqual({ success: true, data: transfer });
  });

  it("mengambil detail transfer dengan validasi site access", async () => {
    const { repository, service } = createService();

    const result = await service.getTransferDetail(defaultDetailInput);

    expect(repository.findTransferById).toHaveBeenCalledWith("transfer-1");
    expect(result).toEqual({ success: true, data: { transfer } });
  });

  it("menolak akses detail transfer jika site tidak sesuai", async () => {
    const { repository, inventoryRouteService, service } = createService();
    repository.findTransferById.mockResolvedValue({
      ...transfer,
      gudangDari: {
        id: "gudang-1",
        kode: "G1",
        nama: "Gudang 1",
        sites: [{ id: "site-2" }],
      },
      gudangKe: {
        id: "gudang-2",
        kode: "G2",
        nama: "Gudang 2",
        sites: [{ id: "site-2" }],
      },
    });
    inventoryRouteService.resolveRestrictedSiteId.mockResolvedValue("site-1");

    const result = await service.getTransferDetail(defaultDetailInput);

    expect(result).toEqual({
      success: false,
      status: 403,
      error: "Anda tidak memiliki akses ke data ini",
    });
  });

  it("mengembalikan 404 jika transfer tidak ditemukan", async () => {
    const { repository, service } = createService();
    repository.findTransferById.mockResolvedValue(null);

    const result = await service.getTransferDetail(defaultDetailInput);

    expect(result).toEqual({
      success: false,
      status: 404,
      error: "Record transfer tidak ditemukan",
    });
  });

  it("mengupdate keterangan transfer setelah validasi site access", async () => {
    const { repository, service } = createService();

    const result = await service.updateTransfer({
      ...defaultDetailInput,
      body: { keterangan: "update" },
    });

    expect(repository.findTransferById).toHaveBeenCalledWith("transfer-1");
    expect(repository.updateTransfer).toHaveBeenCalledWith("transfer-1", {
      keterangan: "update",
    });
    expect(result).toEqual({
      success: true,
      data: { ...transfer, keterangan: "update" },
    });
  });

  it("menghapus transfer setelah validasi site access", async () => {
    const { repository, service } = createService();

    const result = await service.deleteTransfer(defaultDetailInput);

    expect(repository.findTransferById).toHaveBeenCalledWith("transfer-1");
    expect(repository.deleteTransfer).toHaveBeenCalledWith("transfer-1");
    expect(result).toEqual({ success: true, data: null });
  });

  it("superAdmin bisa akses transfer tanpa site restriction", async () => {
    const { inventoryRouteService, service } = createService();
    inventoryRouteService.resolveRestrictedSiteId.mockResolvedValue(undefined);

    const result = await service.getTransferDetail({
      ...defaultDetailInput,
      isSuperAdmin: true,
    });

    expect(result).toEqual({ success: true, data: { transfer } });
  });
});
