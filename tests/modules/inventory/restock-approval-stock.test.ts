import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/database", () => ({ prisma: {} }));

import { InventoryPurchaseRequestRepository } from "@/modules/inventory/repositories/InventoryPurchaseRequestRepository";
import { InventoryRouteService } from "@/modules/inventory/services/InventoryRouteService";

describe("InventoryPurchaseRequestRepository.findApprovalStock", () => {
  it("membaca stok & minimum gudang tujuan pengajuan, dibatasi tenant", async () => {
    const db = {
      purchaseRequest: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ gudangId: "g-1", gudang: { nama: "Gudang A" } }),
      },
      barangGudang: { findMany: vi.fn().mockResolvedValue([]) },
      restockSettings: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const repository = new InventoryPurchaseRequestRepository(db as never);

    const result = await repository.findApprovalStock({
      id: "pr-1",
      tenantId: "tenant-1",
    });

    expect(db.purchaseRequest.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pr-1", tenantId: "tenant-1" } }),
    );
    expect(db.barangGudang.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gudangId: "g-1", tenantId: "tenant-1" },
      }),
    );
    expect(db.restockSettings.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gudangId: "g-1", tenantId: "tenant-1", isActive: true },
      }),
    );
    expect(result).toMatchObject({ gudangId: "g-1", gudangName: "Gudang A" });
  });

  it("pengajuan tidak ada: null tanpa membaca stok", async () => {
    const db = {
      purchaseRequest: { findUnique: vi.fn().mockResolvedValue(null) },
      barangGudang: { findMany: vi.fn() },
      restockSettings: { findMany: vi.fn() },
    };
    const repository = new InventoryPurchaseRequestRepository(db as never);

    expect(
      await repository.findApprovalStock({ id: "x", tenantId: "tenant-1" }),
    ).toBeNull();
    expect(db.barangGudang.findMany).not.toHaveBeenCalled();
  });
});

describe("InventoryRouteService.getApprovalStock", () => {
  it("minimum dari pengaturan restock, lalu minStokDefault; 0 berarti tidak diatur", async () => {
    const repository = {
      findApprovalStock: vi.fn().mockResolvedValue({
        gudangId: "g-1",
        gudangName: "Gudang A",
        stocks: [
          {
            barangId: "b-setting",
            stok: 5,
            stokBaru: 5,
            stokBekas: 0,
            stokRusak: 0,
            barang: { minStokDefault: 2 },
          },
          {
            barangId: "b-default",
            stok: 1,
            stokBaru: 0,
            stokBekas: 1,
            stokRusak: 0,
            barang: { minStokDefault: 3 },
          },
          {
            barangId: "b-none",
            stok: 0,
            stokBaru: 0,
            stokBekas: 0,
            stokRusak: 0,
            barang: { minStokDefault: 0 },
          },
        ],
        settings: [{ barangId: "b-setting", minStok: 10 }],
      }),
    };
    const service = new InventoryRouteService(repository as never);

    const result = await service.getApprovalStock({
      id: "pr-1",
      tenantId: "tenant-1",
    });

    expect(result?.items.map((item) => [item.barangId, item.minStok])).toEqual([
      ["b-setting", 10],
      ["b-default", 3],
      ["b-none", null],
    ]);
    expect(result?.items[1]).toEqual({
      barangId: "b-default",
      stok: 1,
      stokBaru: 0,
      stokBekas: 1,
      stokRusak: 0,
      minStok: 3,
    });
  });
});
