import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { OPNAME_PESAN } from "@/modules/inventory/domain/opname-pesan";
import { InventoryOpnameRepository } from "@/modules/inventory/repositories/InventoryOpnameRepository";
import { mapOpnameError } from "@/modules/inventory/services/InventoryOpnameRouteService";
import { getInventoryOpnameService } from "@/modules/inventory/services/InventoryOpnameService";
import { prismaMock } from "../../setup";

vi.mock("@/lib/auth", () => ({
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/tenant-context", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getTenantIdFromContext: vi.fn() };
});

/** Model yang tidak dideklarasikan tipe mock tetap dibuat proxy-nya saat diakses. */
const db = prismaMock as unknown as Record<
  "barangMasuk" | "stockOpnameAuditLog",
  typeof prismaMock.barangKeluar
>;

const PELAKU = { id: "user-1", nama: "Admin" };
const LOKASI = { barangId: "barang-1", gudangId: "gudang-1" };
const STOCK_KEY = { barangId_gudangId: LOKASI };

function opnameRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "op-1",
    ...LOKASI,
    tenantId: "tenant-1",
    tanggal: new Date("2026-11-20T00:00:00Z"),
    stokFisik: 7,
    stokSistem: 10,
    selisih: -3,
    alasanSelisih: "rusak",
    keterangan: null as string | null,
    kondisiBaik: 7,
    kondisiRusak: 0,
    kondisiExpire: 0,
    tanggalExpire: null as Date | null,
    // Efek tersimpan: opname -3 rusak memotong stokRusak 3.
    efekStokBaru: 0 as number | null,
    efekStokBekas: 0 as number | null,
    efekStokRusak: -3 as number | null,
    barang: { nama: "Kabel UTP" },
    ...overrides,
  };
}

function stockRow(stokBaru: number, stokBekas: number, stokRusak: number) {
  return {
    stok: stokBaru + stokBekas + stokRusak,
    stokBaru,
    stokBekas,
    stokRusak,
  };
}

describe("opname write path", () => {
  beforeEach(() => {
    vi.mocked(getUserPermissions).mockResolvedValue([]);
    vi.mocked(isSuperAdmin).mockReturnValue(false);
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );
  });

  describe("hanya opname terakhir yang boleh diubah/dihapus", () => {
    const repository = new InventoryOpnameRepository(prismaMock as never);

    beforeEach(() => {
      prismaMock.stockOpname.findUnique.mockResolvedValue(opnameRecord());
      prismaMock.stockOpname.findFirst.mockResolvedValue({ id: "op-baru" });
    });

    it("menolak hapus opname lama tanpa menyentuh stok", async () => {
      await expect(repository.deleteOpname("op-1", PELAKU)).rejects.toThrow(
        OPNAME_PESAN.bukanOpnameTerakhir,
      );
      expect(prismaMock.stockOpname.findFirst).toHaveBeenCalledWith({
        where: { ...LOKASI, tenantId: "tenant-1" },
        orderBy: [{ tanggal: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      expect(prismaMock.barangGudang.update).not.toHaveBeenCalled();
      expect(prismaMock.stockOpname.delete).not.toHaveBeenCalled();
    });

    it("menolak ubah opname lama", async () => {
      await expect(
        repository.updateOpname({ id: "op-1", stokFisik: 9 }, PELAKU),
      ).rejects.toThrow(OPNAME_PESAN.bukanOpnameTerakhir);
      expect(prismaMock.stockOpname.update).not.toHaveBeenCalled();
    });

    it("rute menjawab 409 dengan pesan yang sama", () => {
      expect(
        mapOpnameError(new Error(OPNAME_PESAN.bukanOpnameTerakhir)),
      ).toEqual({
        success: false,
        status: 409,
        error: OPNAME_PESAN.bukanOpnameTerakhir,
      });
    });
  });

  describe("hapus opname", () => {
    const repository = new InventoryOpnameRepository(prismaMock as never);

    beforeEach(() => {
      prismaMock.stockOpname.findFirst.mockResolvedValue({ id: "op-1" });
    });

    it("membalik efek tersimpan per kolom lalu menghapus mutasinya", async () => {
      prismaMock.stockOpname.findUnique.mockResolvedValue(opnameRecord());
      // Stok sekarang sesudah opname -3 rusak.
      prismaMock.barangGudang.findUnique.mockResolvedValue(stockRow(7, 0, 0));

      await repository.deleteOpname("op-1", PELAKU);

      expect(prismaMock.barangGudang.update).toHaveBeenCalledWith({
        where: STOCK_KEY,
        data: stockRow(7, 0, 3),
      });
      expect(prismaMock.barangKeluar.deleteMany).toHaveBeenCalledWith({
        where: { opnameId: "op-1" },
      });
      expect(prismaMock.stockOpname.delete).toHaveBeenCalledWith({
        where: { id: "op-1" },
      });
      expect(db.stockOpnameAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ aksi: "DIHAPUS", opnameId: "op-1" }),
        }),
      );
    });

    // Regresi: opname lama dulu selalu mengubah stokBaru sebesar selisih,
    // apa pun kondisi mutasinya; membaliknya di kolom mutasi menggeser stok.
    it("opname lama tanpa efek tersimpan dibalik dari selisihnya di kolom BARU", async () => {
      prismaMock.stockOpname.findUnique.mockResolvedValue(
        opnameRecord({
          selisih: 4,
          stokFisik: 14,
          alasanSelisih: "lebih",
          efekStokBaru: null,
          efekStokBekas: null,
          efekStokRusak: null,
        }),
      );
      prismaMock.barangGudang.findUnique.mockResolvedValue(stockRow(10, 2, 2));

      await repository.deleteOpname("op-1", PELAKU);

      expect(prismaMock.barangGudang.update).toHaveBeenCalledWith({
        where: STOCK_KEY,
        data: stockRow(6, 2, 2),
      });
      expect(db.barangMasuk.deleteMany).toHaveBeenCalledWith({
        where: { opnameId: "op-1" },
      });
    });
  });

  describe("ubah opname", () => {
    const repository = new InventoryOpnameRepository(prismaMock as never);

    beforeEach(() => {
      prismaMock.stockOpname.findFirst.mockResolvedValue({ id: "op-1" });
      prismaMock.stockOpname.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) =>
          opnameRecord(data),
      );
    });

    it("selisih berbalik tanda: mutasi lama diganti, alasan dan kolom ikut berubah", async () => {
      prismaMock.stockOpname.findUnique.mockResolvedValue(opnameRecord());
      prismaMock.barangGudang.findUnique.mockResolvedValue(stockRow(7, 0, 0));

      const result = await repository.updateOpname(
        {
          id: "op-1",
          stokFisik: 12,
          kondisiBaik: 12,
          alasanSelisih: "lebih",
        },
        PELAKU,
      );

      expect(result).toMatchObject({ stokSistem: 10, selisih: 2 });
      expect(prismaMock.barangKeluar.deleteMany).toHaveBeenCalledWith({
        where: { opnameId: "op-1" },
      });
      expect(prismaMock.stockOpname.update).toHaveBeenCalledWith({
        where: { id: "op-1" },
        data: expect.objectContaining({
          stokFisik: 12,
          selisih: 2,
          alasanSelisih: "lebih",
        }),
      });
      expect(db.barangMasuk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...LOKASI,
          jumlah: 2,
          kondisi: "BARU",
          opnameId: "op-1",
        }),
      });
      expect(prismaMock.barangKeluar.create).not.toHaveBeenCalled();
      // Batal: 7 baru + 3 rusak kembali; lalu +2 baru.
      expect(prismaMock.barangGudang.update).toHaveBeenCalledWith({
        where: STOCK_KEY,
        data: stockRow(9, 0, 3),
      });
      // Efek baru disimpan relatif terhadap stok setelah efek lama dibatalkan.
      expect(prismaMock.stockOpname.update).toHaveBeenCalledWith({
        where: { id: "op-1" },
        data: { efekStokBaru: 2, efekStokBekas: 0, efekStokRusak: 0 },
      });
    });

    it("alasan lama dipakai bila tidak dikirim, dan dikosongkan saat selisih jadi 0", async () => {
      prismaMock.stockOpname.findUnique.mockResolvedValue(opnameRecord());
      prismaMock.barangGudang.findUnique.mockResolvedValue(stockRow(7, 0, 0));

      await repository.updateOpname({ id: "op-1", stokFisik: 10 }, PELAKU);

      expect(prismaMock.stockOpname.update).toHaveBeenCalledWith({
        where: { id: "op-1" },
        data: expect.objectContaining({ selisih: 0, alasanSelisih: null }),
      });
      expect(db.barangMasuk.create).not.toHaveBeenCalled();
      expect(prismaMock.barangKeluar.create).not.toHaveBeenCalled();
      expect(prismaMock.barangGudang.update).toHaveBeenCalledWith({
        where: STOCK_KEY,
        data: stockRow(7, 0, 3),
      });
    });

    it("selisih tetap negatif tanpa alasan baru memakai alasan lama", async () => {
      prismaMock.stockOpname.findUnique.mockResolvedValue(opnameRecord());
      prismaMock.barangGudang.findUnique.mockResolvedValue(stockRow(7, 0, 0));

      await repository.updateOpname({ id: "op-1", stokFisik: 9 }, PELAKU);

      expect(prismaMock.barangKeluar.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jumlah: 1,
          kondisi: "RUSAK",
          opnameId: "op-1",
        }),
      });
      expect(prismaMock.barangGudang.update).toHaveBeenCalledWith({
        where: STOCK_KEY,
        data: stockRow(7, 0, 2),
      });
    });
  });

  describe("buat opname", () => {
    const service = getInventoryOpnameService();
    const USER = {
      id: "user-1",
      name: "Admin",
      role: "ADMIN",
      permissions: [] as string[],
      tenantId: "tenant-1",
    };

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({
        siteId: "site-1",
        role: null,
        userSites: [],
      });
      prismaMock.gudang.findUnique.mockResolvedValue({
        id: "gudang-1",
        tenantId: "tenant-1",
        sites: [{ id: "site-1" }],
        isActive: true,
      });
      prismaMock.barang.findUnique.mockResolvedValue({
        id: "barang-1",
        nama: "Kabel UTP",
        tenantId: "tenant-1",
      });
      prismaMock.stockOpname.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...data,
          tenantId: "tenant-1",
        }),
      );
    });

    it("selisih kurang karena rusak: mutasi keluar tertaut dan kolom rusak yang berkurang", async () => {
      prismaMock.barangGudang.findUnique.mockResolvedValue({
        ...stockRow(6, 0, 4),
        tenantId: "tenant-1",
      });

      const result = await service.createOpname({
        user: USER,
        ...LOKASI,
        stokFisik: 7,
        alasanSelisih: "rusak",
      });

      const opnameId = result.opnameRecord.id;
      expect(result.selisih).toBe(-3);
      expect(prismaMock.barangKeluar.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jumlah: 3,
          kondisi: "RUSAK",
          opnameId,
          keterangan: expect.stringContaining(`Ref: ${opnameId}`),
        }),
      });
      expect(prismaMock.barangGudang.update).toHaveBeenCalledWith({
        where: STOCK_KEY,
        data: stockRow(6, 0, 1),
      });
      // Efek yang diterapkan disimpan agar hapus/ubah bisa membaliknya persis.
      expect(prismaMock.stockOpname.update).toHaveBeenCalledWith({
        where: { id: opnameId },
        data: { efekStokBaru: 0, efekStokBekas: 0, efekStokRusak: -3 },
      });
    });

    it("selisih lebih masuk ke kolom kondisi mayoritas breakdown", async () => {
      prismaMock.barangGudang.findUnique.mockResolvedValue({
        ...stockRow(5, 0, 0),
        tenantId: "tenant-1",
      });

      const result = await service.createOpname({
        user: USER,
        ...LOKASI,
        stokFisik: 7,
        kondisiBaik: 5,
        kondisiExpire: 2,
        alasanSelisih: "lebih",
      });

      expect(db.barangMasuk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jumlah: 2,
          kondisi: "BARU",
          opnameId: result.opnameRecord.id,
        }),
      });
      expect(prismaMock.barangGudang.update).toHaveBeenCalledWith({
        where: STOCK_KEY,
        data: stockRow(7, 0, 0),
      });
    });

    it("penyesuaian administratif tanpa mutasi tetap menyamakan stok dengan hitungan fisik", async () => {
      prismaMock.barangGudang.findUnique.mockResolvedValue({
        ...stockRow(3, 2, 0),
        tenantId: "tenant-1",
      });

      await service.createOpname({
        user: USER,
        ...LOKASI,
        stokFisik: 9,
        alasanSelisih: "revisi",
      });

      expect(db.barangMasuk.create).not.toHaveBeenCalled();
      expect(prismaMock.barangKeluar.create).not.toHaveBeenCalled();
      expect(prismaMock.barangGudang.update).toHaveBeenCalledWith({
        where: STOCK_KEY,
        data: stockRow(7, 2, 0),
      });
    });
  });
});
