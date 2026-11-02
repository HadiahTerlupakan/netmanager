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

const PENGGUNA = {
  userId: "user-1",
  permissions: ["barang:site_only"],
  isSuperAdmin: false,
};

/** Route service palsu yang menjawab lingkup site tertentu. */
function routeServiceDenganLingkup(
  lingkup: { dibatasi: false } | { dibatasi: true; siteIds: string[] },
) {
  return { resolveLingkupSite: vi.fn().mockResolvedValue(lingkup) };
}

function createServiceWithRepository(
  repository: Record<string, unknown>,
  lingkup: { dibatasi: false } | { dibatasi: true; siteIds: string[] } = {
    dibatasi: false,
  },
) {
  return new InventoryBarangRouteService(
    repository as never,
    {} as never,
    routeServiceDenganLingkup(lingkup) as never,
  );
}

describe("InventoryBarangRouteService", () => {
  it("mengambil detail barang dan menghitung stok sesuai site", async () => {
    const repository = {
      findBarangDetail: vi.fn().mockResolvedValue(barang),
    };
    const service = createServiceWithRepository(repository, {
      dibatasi: true,
      siteIds: ["site-1"],
    });

    const result = await service.getBarangDetail({
      id: "barang-1",
      pengguna: PENGGUNA,
    });

    expect(repository.findBarangDetail).toHaveBeenCalledWith("barang-1", {
      masuk: ["site-1"],
      keluar: ["site-1"],
      opname: ["site-1"],
    });
    expect(result).toEqual({
      found: true,
      barang: {
        ...barang,
        barangGudang: [barang.barangGudang[0]],
        totalStock: 3,
      },
    });
  });

  it("menyaring mutasi terbaru per sumbu daftarnya masing-masing", async () => {
    const repository = {
      findBarangDetail: vi.fn().mockResolvedValue(barang),
    };
    // Hanya `masuk:site_only` yang menyala: stok & mutasi lain tetap terbuka.
    const inventoryRouteService = {
      resolveLingkupSite: vi.fn(
        async (input: { restrictedPermissions: readonly string[] }) =>
          input.restrictedPermissions.includes("masuk:site_only")
            ? { dibatasi: true, siteIds: ["site-2"] }
            : { dibatasi: false },
      ),
    };
    const service = new InventoryBarangRouteService(
      repository as never,
      {} as never,
      inventoryRouteService as never,
    );

    await service.getBarangDetail({
      id: "barang-1",
      pengguna: { ...PENGGUNA, permissions: ["masuk:site_only"] },
    });

    const sumbu = inventoryRouteService.resolveLingkupSite.mock.calls.map(
      ([input]) => input.restrictedPermissions,
    );
    expect(sumbu).toEqual(
      expect.arrayContaining([
        ["barang:site_only", "gudang:site_only"],
        ["masuk:site_only", "barang:site_only", "gudang:site_only"],
        ["keluar:site_only", "barang:site_only", "gudang:site_only"],
        ["opname:site_only", "barang:site_only", "gudang:site_only"],
      ]),
    );
    expect(repository.findBarangDetail).toHaveBeenCalledWith("barang-1", {
      masuk: ["site-2"],
      keluar: undefined,
      opname: undefined,
    });
  });

  it("pengguna dibatasi tanpa site tidak melihat mutasi terbaru apa pun", async () => {
    const repository = {
      findBarangDetail: vi.fn().mockResolvedValue(barang),
    };
    const service = createServiceWithRepository(repository, {
      dibatasi: true,
      siteIds: [],
    });

    await service.getBarangDetail({ id: "barang-1", pengguna: PENGGUNA });

    expect(repository.findBarangDetail).toHaveBeenCalledWith("barang-1", {
      masuk: [],
      keluar: [],
      opname: [],
    });
  });

  it("menolak update barang ketika kode sudah dipakai barang lain", async () => {
    const repository = {
      findBarangById: vi.fn().mockResolvedValue(barang),
      findBarangByKode: vi
        .fn()
        .mockResolvedValue({ id: "barang-2", nama: "Kabel Drop" }),
      updateBarang: vi.fn(),
    };
    const service = createServiceWithRepository(repository);

    const result = await service.updateBarang({
      id: "barang-1",
      pengguna: PENGGUNA,
      body: { kode: "BRG-2", nama: "Kabel", satuan: "meter" },
    });

    expect(result).toEqual({
      success: false,
      status: 409,
      error:
        'Kode barang "BRG-2" sudah dipakai barang "Kabel Drop". Pakai kode lain.',
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
    const inventoryRouteService = routeServiceDenganLingkup({
      dibatasi: true,
      siteIds: ["site-1", "site-2"],
    });
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

    expect(inventoryRouteService.resolveLingkupSite).toHaveBeenCalledWith({
      ...PENGGUNA,
      restrictedPermissions: ["barang:site_only", "gudang:site_only"],
    });
    expect(inventoryBarangService.listBarang).toHaveBeenCalledWith({
      userId: "user-1",
      search: "kabel",
      gudangId: null,
      page: 1,
      limit: 10,
      siteIds: ["site-1", "site-2"],
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
      error:
        "Nama barang belum diisi. Tulis nama barangnya, contoh: Kabel Drop 1 Core.",
      details: {
        nama: [
          "Nama barang belum diisi. Tulis nama barangnya, contoh: Kabel Drop 1 Core.",
        ],
      },
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
    const service = createServiceWithRepository(repository, {
      dibatasi: true,
      siteIds: ["site-1"],
    });

    const result = await service.deleteBarang({
      id: "barang-1",
      pengguna: PENGGUNA,
    });

    expect(repository.deleteBarang).toHaveBeenCalledWith("barang-1");
    expect(result).toEqual({
      success: true,
      data: null,
      message: "Barang berhasil dihapus",
    });
  });

  it("user dibatasi tanpa site tidak bisa menghapus barang dan tidak melihat stok", async () => {
    const repository = {
      findBarangById: vi.fn().mockResolvedValue(barang),
      findBarangDetail: vi.fn().mockResolvedValue(barang),
      deleteBarang: vi.fn(),
    };
    const service = createServiceWithRepository(repository, {
      dibatasi: true,
      siteIds: [],
    });

    const deleted = await service.deleteBarang({
      id: "barang-1",
      pengguna: PENGGUNA,
    });
    const detail = await service.getBarangDetail({
      id: "barang-1",
      pengguna: PENGGUNA,
    });

    expect(deleted).toMatchObject({ success: false, status: 403 });
    expect(repository.deleteBarang).not.toHaveBeenCalled();
    expect(detail).toMatchObject({
      found: true,
      barang: { barangGudang: [], totalStock: 0 },
    });
  });
});
