import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import { InventoryRepository } from "@/modules/inventory/repositories/InventoryRepository";
import type { Barang, BarangGudang, Gudang } from "@prisma/client";

// Note: InventoryRepository uses an internal `this.db` instance.
// For proper testing, we would need to inject the prisma client.
// These tests verify the expected behavior using mocked prisma calls.

describe("InventoryRepository", () => {
  let repository: InventoryRepository;

  beforeEach(() => {
    // Create repository - it will use the mocked prisma from setup
    repository = new InventoryRepository();
  });

  describe("createBarang", () => {
    it("should create new barang successfully", async () => {
      const input = {
        kode: "BRG-001",
        nama: "Kabel Fiber",
        satuan: "Meter",
        minStock: 100,
      };

      const mockCreatedBarang = {
        id: "barang-1",
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.barang.create.mockResolvedValueOnce(
        mockCreatedBarang as unknown as Barang,
      );

      const result = await repository.createBarang(input);

      expect(result).toBeDefined();
    });
  });

  describe("findBarangByKode", () => {
    it("should find barang by kode using findFirst", async () => {
      const mockBarang = {
        id: "barang-1",
        kode: "BRG-001",
        nama: "Kabel Fiber",
        barangGudang: [] as unknown as BarangGudang[],
      };

      prismaMock.barang.findFirst.mockResolvedValueOnce(
        mockBarang as unknown as Barang,
      );

      const result = await repository.findBarangByKode("BRG-001");

      expect(result).toBeDefined();
      expect(result?.kode).toBe("BRG-001");
    });

    it("should return null if barang not found", async () => {
      prismaMock.barang.findFirst.mockResolvedValueOnce(null);

      const result = await repository.findBarangByKode("NONEXISTENT");

      expect(result).toBeNull();
    });
  });

  describe("getStockLevel", () => {
    it("should return stock from barangGudang", async () => {
      prismaMock.barangGudang.findUnique.mockResolvedValueOnce({
        id: "bg-1",
        stok: 50,
      } as unknown as BarangGudang);

      const result = await repository.getStockLevel("barang-1", "gudang-1");

      expect(result).toBe(50);
    });

    it("should return 0 if no stock record exists", async () => {
      prismaMock.barangGudang.findUnique.mockResolvedValueOnce(null);

      const result = await repository.getStockLevel("barang-1", "gudang-1");

      expect(result).toBe(0);
    });
  });

  describe("getStockBreakdown", () => {
    it("should return correct stock breakdown from BarangGudang record", async () => {
      // Mock the pre-calculated stock record from BarangGudang
      prismaMock.barangGudang.findUnique.mockResolvedValueOnce({
        stokBaru: 20,
        stokBekas: 15,
        stokRusak: 5,
        stok: 40,
      } as unknown as BarangGudang);

      const result = await repository.getStockBreakdown("barang-1", "gudang-1");

      expect(prismaMock.barangGudang.findUnique).toHaveBeenCalledWith({
        where: {
          barangId_gudangId: { barangId: "barang-1", gudangId: "gudang-1" },
        },
        select: {
          stokBaru: true,
          stokBekas: true,
          stokRusak: true,
          stok: true,
        },
      });

      expect(result.baru).toBe(20);
      expect(result.bekas).toBe(15);
      expect(result.rusak).toBe(5);
      expect(result.total).toBe(40);
    });

    it("should return all zeros if no stock record is found", async () => {
      // Mock that no stock record is found
      prismaMock.barangGudang.findUnique.mockResolvedValueOnce(null);

      const result = await repository.getStockBreakdown("barang-1", "gudang-1");

      expect(result.baru).toBe(0);
      expect(result.bekas).toBe(0);
      expect(result.rusak).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("updateBarang", () => {
    it("should reject unit changes when stock still exists", async () => {
      prismaMock.barang.findUnique.mockResolvedValueOnce({
        id: "barang-1",
        kode: "BRG-001",
        nama: "Kabel Fiber",
        satuan: "pcs",
      } as unknown as Barang);
      prismaMock.barangGudang.count.mockResolvedValueOnce(2);

      await expect(
        repository.updateBarang("barang-1", {
          nama: "Kabel Fiber",
          satuan: "meter",
        }),
      ).rejects.toThrow(
        "Satuan barang tidak boleh diubah saat stok masih tersedia",
      );
      expect(prismaMock.barang.update).not.toHaveBeenCalled();
    });
  });

  describe("findTransferById", () => {
    it("should normalize related fields for transfer detail consumers", async () => {
      prismaMock.transferAntarGudang.findUnique.mockResolvedValueOnce({
        id: "transfer-1",
        kodeTransfer: "TRF-001",
        gudangDari: { id: "gudang-1", kode: "GDP", nama: "Gudang Pusat" },
        gudangKe: { id: "gudang-2", kode: "GDC", nama: "Gudang Cabang" },
        barangMasuk: [
          {
            id: "masuk-1",
            tanggal: new Date("2026-01-01T08:00:00.000Z"),
            jumlah: 3,
            kondisi: "BARU",
            keterangan: "Transfer dari Gudang Pusat",
          },
        ],
        barangKeluar: [
          {
            id: "keluar-1",
            tanggal: new Date("2026-01-01T07:00:00.000Z"),
            jumlah: 3,
            kondisi: "BARU",
            keterangan: "Transfer ke Gudang Cabang",
          },
        ],
      });

      const result = await repository.findTransferById("transfer-1");

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.dariGudang).toEqual({
        id: "gudang-1",
        kode: "GDP",
        nama: "Gudang Pusat",
      });
      expect(result.keGudang).toEqual({
        id: "gudang-2",
        kode: "GDC",
        nama: "Gudang Cabang",
      });
      expect(result.keluar).toEqual({
        id: "keluar-1",
        tanggal: new Date("2026-01-01T07:00:00.000Z"),
        jumlah: 3,
        kondisi: "BARU",
        keterangan: "Transfer ke Gudang Cabang",
      });
      expect(result.masuk).toEqual({
        id: "masuk-1",
        tanggal: new Date("2026-01-01T08:00:00.000Z"),
        jumlah: 3,
        kondisi: "BARU",
        keterangan: "Transfer dari Gudang Pusat",
      });
    });
  });

  describe("getAllGudang", () => {
    it("should return all active gudang", async () => {
      const mockGudang = [
        { id: "gudang-1", nama: "Gudang Pusat", isActive: true },
        { id: "gudang-2", nama: "Gudang Cabang", isActive: true },
      ];

      prismaMock.gudang.findMany.mockResolvedValueOnce(
        mockGudang as unknown as Gudang[],
      );

      const result = await repository.getAllGudang();

      expect(result).toHaveLength(2);
    });
  });

  describe("hasStockInGudang", () => {
    it("should return true if gudang has stock", async () => {
      prismaMock.barangGudang.count.mockResolvedValueOnce(5);

      const result = await repository.hasStockInGudang("gudang-1");

      expect(result).toBe(true);
    });

    it("should return false if gudang has no stock", async () => {
      prismaMock.barangGudang.count.mockResolvedValueOnce(0);

      const result = await repository.hasStockInGudang("gudang-1");

      expect(result).toBe(false);
    });
  });
});
