import { describe, expect, it, vi } from "vitest";

import { InventoryTransferRouteService } from "@/modules/inventory";

const transfer = {
  id: "transfer-1",
  kodeTransfer: "TRF-1",
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

  it("mengambil detail transfer", async () => {
    const { repository, service } = createService();

    const result = await service.getTransferDetail("transfer-1");

    expect(repository.findTransferById).toHaveBeenCalledWith("transfer-1");
    expect(result).toEqual({ found: true, transfer });
  });

  it("mengupdate keterangan transfer", async () => {
    const { repository, service } = createService();

    const result = await service.updateTransfer({
      id: "transfer-1",
      body: { keterangan: "update" },
    });

    expect(repository.updateTransfer).toHaveBeenCalledWith("transfer-1", {
      keterangan: "update",
    });
    expect(result).toEqual({
      success: true,
      data: { ...transfer, keterangan: "update" },
    });
  });

  it("menghapus transfer melalui repository", async () => {
    const { repository, service } = createService();

    const result = await service.deleteTransfer("transfer-1");

    expect(repository.deleteTransfer).toHaveBeenCalledWith("transfer-1");
    expect(result).toEqual({ success: true, data: null });
  });
});
