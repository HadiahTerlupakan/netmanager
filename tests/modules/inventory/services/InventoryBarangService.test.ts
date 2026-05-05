import { describe, it, expect, beforeEach, vi } from "vitest";
import { InventoryBarangService } from "@/modules/inventory/services/InventoryBarangService";
import type { IInventoryRepository } from "@/modules/inventory/domain/ports/IInventoryRepository";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: vi.fn(),
  },
}));

// Mock helpers
vi.mock(
  "@/modules/inventory/services/inventory-barang.service-helpers",
  () => ({
    mapBarangListItem: vi.fn(
      (params: { barang: unknown; gudangId?: string | null }) => params.barang,
    ),
    resolveUniqueBarangCode: vi.fn(
      async (_repo: unknown, kode?: string) => kode || "BRG-001",
    ),
  }),
);

describe("InventoryBarangService", () => {
  let inventoryBarangService: InventoryBarangService;
  let mockInventoryRepository: IInventoryRepository;

  const mockBarang = {
    id: "barang-1",
    kode: "BRG-001",
    nama: "Test Item",
    satuan: "pcs",
    isWorkOrderMaterial: false,
    jenis: "consumable",
    kategoriAset: null as string | null,
    minStokDefault: 10,
    createdAt: new Date("2026-05-05"),
    updatedAt: new Date("2026-05-05"),
  };

  const mockBarangList = {
    items: [mockBarang],
    total: 1,
  };

  beforeEach(() => {
    mockInventoryRepository = {
      findAllBarang: vi.fn(),
      createBarang: vi.fn(),
      updateBarang: vi.fn(),
      deleteBarang: vi.fn(),
      findBarangById: vi.fn(),
    } as unknown as IInventoryRepository;

    inventoryBarangService = new InventoryBarangService(
      mockInventoryRepository,
    );
  });

  describe("listBarang", () => {
    it("harus return paginated barang list", async () => {
      const input = {
        userId: "user-1",
        page: 1,
        limit: 10,
      };

      vi.mocked(mockInventoryRepository.findAllBarang).mockResolvedValue(
        mockBarangList as never,
      );

      const result = await inventoryBarangService.listBarang(input);

      expect(result.barangs).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(mockInventoryRepository.findAllBarang).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
      });
    });

    it("harus filter by search", async () => {
      const input = {
        userId: "user-1",
        search: "Test",
        page: 1,
        limit: 10,
      };

      vi.mocked(mockInventoryRepository.findAllBarang).mockResolvedValue(
        mockBarangList as never,
      );

      await inventoryBarangService.listBarang(input);

      expect(mockInventoryRepository.findAllBarang).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        search: "Test",
      });
    });

    it("harus filter by gudangId", async () => {
      const input = {
        userId: "user-1",
        gudangId: "gudang-1",
        page: 1,
        limit: 10,
      };

      vi.mocked(mockInventoryRepository.findAllBarang).mockResolvedValue(
        mockBarangList as never,
      );

      await inventoryBarangService.listBarang(input);

      expect(mockInventoryRepository.findAllBarang).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        gudangId: "gudang-1",
      });
    });

    it("harus filter by siteId", async () => {
      const input = {
        userId: "user-1",
        siteId: "site-1",
        page: 1,
        limit: 10,
      };

      vi.mocked(mockInventoryRepository.findAllBarang).mockResolvedValue(
        mockBarangList as never,
      );

      await inventoryBarangService.listBarang(input);

      expect(mockInventoryRepository.findAllBarang).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        siteId: "site-1",
      });
    });

    it("harus calculate pagination correctly", async () => {
      const input = {
        userId: "user-1",
        page: 2,
        limit: 20,
      };

      const mockLargeList = {
        items: Array(20).fill(mockBarang),
        total: 45,
      };

      vi.mocked(mockInventoryRepository.findAllBarang).mockResolvedValue(
        mockLargeList as never,
      );

      const result = await inventoryBarangService.listBarang(input);

      expect(result.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
      expect(mockInventoryRepository.findAllBarang).toHaveBeenCalledWith({
        skip: 20,
        take: 20,
      });
    });
  });

  describe("createBarang", () => {
    it("harus create barang dengan kode yang diberikan", async () => {
      const input = {
        userId: "user-1",
        kode: "BRG-001",
        nama: "Test Item",
        satuan: "pcs",
      };

      vi.mocked(mockInventoryRepository.createBarang).mockResolvedValue(
        mockBarang as never,
      );

      const result = await inventoryBarangService.createBarang(input);

      expect(result.barang).toEqual(mockBarang);
      expect(mockInventoryRepository.createBarang).toHaveBeenCalledWith({
        kode: "BRG-001",
        nama: "Test Item",
        satuan: "pcs",
        isWorkOrderMaterial: undefined,
        jenis: undefined,
        kategoriAset: undefined,
        minStokDefault: undefined,
      });
    });

    it("harus create barang dengan auto-generated kode", async () => {
      const input = {
        userId: "user-1",
        nama: "Test Item",
        satuan: "pcs",
      };

      vi.mocked(mockInventoryRepository.createBarang).mockResolvedValue(
        mockBarang as never,
      );

      const result = await inventoryBarangService.createBarang(input);

      expect(result.barang).toEqual(mockBarang);
      expect(mockInventoryRepository.createBarang).toHaveBeenCalled();
    });

    it("harus create barang dengan optional fields", async () => {
      const input = {
        userId: "user-1",
        kode: "BRG-002",
        nama: "Work Order Material",
        satuan: "unit",
        isWorkOrderMaterial: true,
        jenis: "asset",
        kategoriAset: "IT",
        minStokDefault: 5,
      };

      const mockBarangWithOptionals = {
        ...mockBarang,
        id: "barang-2",
        kode: "BRG-002",
        nama: "Work Order Material",
        satuan: "unit",
        isWorkOrderMaterial: true,
        jenis: "asset",
        kategoriAset: "IT",
        minStokDefault: 5,
      };

      vi.mocked(mockInventoryRepository.createBarang).mockResolvedValue(
        mockBarangWithOptionals as never,
      );

      const result = await inventoryBarangService.createBarang(input);

      expect(result.barang).toEqual(mockBarangWithOptionals);
      expect(mockInventoryRepository.createBarang).toHaveBeenCalledWith({
        kode: "BRG-002",
        nama: "Work Order Material",
        satuan: "unit",
        isWorkOrderMaterial: true,
        jenis: "asset",
        kategoriAset: "IT",
        minStokDefault: 5,
      });
    });

    it("harus log activity setelah create barang", async () => {
      const input = {
        userId: "user-1",
        kode: "BRG-001",
        nama: "Test Item",
        satuan: "pcs",
      };

      vi.mocked(mockInventoryRepository.createBarang).mockResolvedValue(
        mockBarang as never,
      );

      const { logger } = await import("@/lib/logger");

      await inventoryBarangService.createBarang(input);

      expect(logger.logActivity).toHaveBeenCalledWith({
        action: "CREATE",
        subject: "Barang",
        userId: "user-1",
        details: { id: "barang-1", nama: "Test Item", kode: "BRG-001" },
      });
    });
  });
});
