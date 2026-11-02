import { describe, expect, it, vi } from "vitest";

import {
  InventoryTransferRouteService,
  TRANSFER_MESSAGES,
  TransferRejectedError,
} from "@/modules/inventory";

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
    resolveLingkupSite: vi
      .fn()
      .mockResolvedValue({ dibatasi: true, siteIds: ["site-1"] }),
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

    expect(inventoryRouteService.resolveLingkupSite).toHaveBeenCalledWith({
      userId: "user-1",
      permissions: ["transfer:site_only"],
      isSuperAdmin: false,
      restrictedPermissions: [
        "transfer:site_only",
        "barang:site_only",
        "gudang:site_only",
      ],
    });
    expect(repository.findAllTransfers).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      barangId: "barang-1",
      siteIds: ["site-1"],
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
      error: TRANSFER_MESSAGES.gudangSama,
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
    const { repository, service } = createService();
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

    const result = await service.getTransferDetail(defaultDetailInput);

    expect(result).toEqual({
      success: false,
      status: 403,
      error: TRANSFER_MESSAGES.transferBedaSite,
    });
  });

  it("mengembalikan 404 jika transfer tidak ditemukan", async () => {
    const { repository, service } = createService();
    repository.findTransferById.mockResolvedValue(null);

    const result = await service.getTransferDetail(defaultDetailInput);

    expect(result).toEqual({
      success: false,
      status: 404,
      error: TRANSFER_MESSAGES.transferTidakAda,
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

  describe("transfer yang hanya satu sisinya di site user", () => {
    const transferSatuSisi = {
      ...transfer,
      gudangKe: {
        id: "gudang-2",
        kode: "G2",
        nama: "Gudang 2",
        sites: [{ id: "site-2" }],
      },
    };

    it("detail tetap boleh dibuka", async () => {
      const { repository, service } = createService();
      repository.findTransferById.mockResolvedValue(transferSatuSisi);

      const result = await service.getTransferDetail(defaultDetailInput);

      expect(result).toEqual({
        success: true,
        data: { transfer: transferSatuSisi },
      });
    });

    it("ubah ditolak karena wajib memegang kedua gudang", async () => {
      const { repository, service } = createService();
      repository.findTransferById.mockResolvedValue(transferSatuSisi);

      const result = await service.updateTransfer({
        ...defaultDetailInput,
        body: { keterangan: "baru" },
      });

      expect(result).toEqual({
        success: false,
        status: 403,
        error: TRANSFER_MESSAGES.transferSebagianBedaSite,
      });
      expect(repository.updateTransfer).not.toHaveBeenCalled();
    });

    it("hapus ditolak karena membalik stok di kedua gudang", async () => {
      const { repository, service } = createService();
      repository.findTransferById.mockResolvedValue(transferSatuSisi);

      const result = await service.deleteTransfer(defaultDetailInput);

      expect(result).toEqual({
        success: false,
        status: 403,
        error: TRANSFER_MESSAGES.transferSebagianBedaSite,
      });
      expect(repository.deleteTransfer).not.toHaveBeenCalled();
    });
  });

  it("user dibatasi tanpa site tidak bisa membuka transfer mana pun", async () => {
    const { inventoryRouteService, service } = createService();
    inventoryRouteService.resolveLingkupSite.mockResolvedValue({
      dibatasi: true,
      siteIds: [],
    });

    const result = await service.getTransferDetail(defaultDetailInput);

    expect(result).toMatchObject({ success: false, status: 403 });
  });

  it("superAdmin bisa akses transfer tanpa site restriction", async () => {
    const { inventoryRouteService, service } = createService();
    inventoryRouteService.resolveLingkupSite.mockResolvedValue({
      dibatasi: false,
    });

    const result = await service.getTransferDetail({
      ...defaultDetailInput,
      isSuperAdmin: true,
    });

    expect(result).toEqual({ success: true, data: { transfer } });
  });

  it("melaporkan semua isian yang salah sekaligus, satu per baris", async () => {
    const { repository, service } = createService();

    const result = await service.createTransfer({
      userId: "user-1",
      body: {
        barangId: "",
        dariGudangId: "gudang-1",
        keGudangId: "",
        jumlah: "",
      },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: [
        TRANSFER_MESSAGES.barangKosong,
        TRANSFER_MESSAGES.gudangTujuanKosong,
        TRANSFER_MESSAGES.jumlahKosong,
      ].join("\n"),
    });
    expect(repository.createTransfer).not.toHaveBeenCalled();
  });

  it.each([
    [2.5, TRANSFER_MESSAGES.jumlahBerkoma],
    [0, TRANSFER_MESSAGES.jumlahTidakPositif],
    [-3, TRANSFER_MESSAGES.jumlahTidakPositif],
    ["lima", TRANSFER_MESSAGES.jumlahBukanAngka],
  ])("menolak jumlah %s dengan pesan yang jelas", async (jumlah, pesan) => {
    const { repository, service } = createService();

    const result = await service.createTransfer({
      userId: "user-1",
      body: { barangId: "b1", dariGudangId: "g1", keGudangId: "g2", jumlah },
    });

    expect(result).toEqual({ success: false, status: 400, error: pesan });
    expect(repository.createTransfer).not.toHaveBeenCalled();
  });

  it("menolak kondisi yang tidak dikenal sebelum sampai ke database", async () => {
    const { repository, service } = createService();

    const result = await service.createTransfer({
      userId: "user-1",
      body: {
        barangId: "b1",
        dariGudangId: "g1",
        keGudangId: "g2",
        jumlah: 1,
        kondisi: "HILANG",
      },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: TRANSFER_MESSAGES.kondisiTidakDikenal,
    });
    expect(repository.createTransfer).not.toHaveBeenCalled();
  });

  it("meneruskan penolakan dari repository dengan status dan pesannya", async () => {
    const { repository, service } = createService();
    repository.createTransfer.mockRejectedValue(
      new TransferRejectedError(400, "Stok kurang"),
    );

    const result = await service.createTransfer({
      userId: "user-1",
      body: { barangId: "b1", dariGudangId: "g1", keGudangId: "g2", jumlah: 5 },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Stok kurang",
    });
  });

  it("melempar error tak terduga agar route mencatatnya sebagai 500", async () => {
    const { repository, service } = createService();
    repository.createTransfer.mockRejectedValue(new Error("connection reset"));

    await expect(
      service.createTransfer({
        userId: "user-1",
        body: {
          barangId: "b1",
          dariGudangId: "g1",
          keGudangId: "g2",
          jumlah: 5,
        },
      }),
    ).rejects.toThrow("connection reset");
  });

  it("mengembalikan 409 bila transfer tidak bisa dibatalkan", async () => {
    const { repository, service } = createService();
    repository.deleteTransfer.mockRejectedValue(
      new TransferRejectedError(409, "Barang di gudang tujuan sudah dipakai"),
    );

    const result = await service.deleteTransfer(defaultDetailInput);

    expect(result).toEqual({
      success: false,
      status: 409,
      error: "Barang di gudang tujuan sudah dipakai",
    });
  });

  it("mengembalikan 404 bila transfer hilang saat keterangan diubah", async () => {
    const { repository, service } = createService();
    repository.updateTransfer.mockRejectedValue(
      Object.assign(new Error("Record to update not found."), {
        code: "P2025",
      }),
    );

    const result = await service.updateTransfer({
      ...defaultDetailInput,
      body: { keterangan: "baru" },
    });

    expect(result).toEqual({
      success: false,
      status: 404,
      error: TRANSFER_MESSAGES.transferTidakAda,
    });
  });
});
