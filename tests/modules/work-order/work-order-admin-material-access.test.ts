import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/inventory", () => ({ InventoryStockService: class {} }));

import { WorkOrderMaterialService } from "@/modules/work-order/services/WorkOrderMaterialService";

/**
 * Tombol "Tambah Material" di detail WO panel admin memanggil
 * `POST /api/admin/workorders/:id/materials` (dijaga `workorders:update`).
 * Refactor 0fbe85503 menukar validasinya ke syarat mobile "hanya lead teknisi
 * dan partner", sehingga admin selalu ditolak. Jalur admin kembali memakai
 * lingkup site/departemen.
 */

const WORK_ORDER = {
  id: "wo-1",
  status: "IN_PROGRESS",
  siteId: "site-a",
  departmentId: null as string | null,
  tenantId: "tenant-1",
  assignedToId: "teknisi-1",
  assignments: [] as unknown[],
};

function createService(workOrder: unknown = WORK_ORDER) {
  const addMaterialWithStockDeduction = vi
    .fn()
    .mockResolvedValue({ id: "material-1" });
  const service = new WorkOrderMaterialService({
    prismaClient: {} as never,
    repository: { findById: vi.fn().mockResolvedValue(workOrder) } as never,
    materialRepository: { addMaterialWithStockDeduction } as never,
    inventoryService: {} as never,
  });
  return { service, addMaterialWithStockDeduction };
}

describe("admin menambah material work order", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin bukan pemegang WO boleh menambah material dalam lingkupnya", async () => {
    const { service, addMaterialWithStockDeduction } = createService();

    const result = await service.addMaterial(
      "wo-1",
      "barang-1",
      2,
      {
        id: "admin-1",
        role: "Admin",
        permissions: ["workorders:site_only"],
        siteId: "site-a",
      },
      undefined,
      "gudang-1",
    );

    expect(result).toEqual({ success: true, data: { id: "material-1" } });
    expect(addMaterialWithStockDeduction).toHaveBeenCalledWith(
      "wo-1",
      "barang-1",
      2,
      "admin-1",
      null,
      "gudang-1",
    );
  });

  it("admin di luar lingkup site ditolak FORBIDDEN tanpa memotong stok", async () => {
    const { service, addMaterialWithStockDeduction } = createService();

    const result = await service.addMaterial("wo-1", "barang-1", 2, {
      id: "admin-2",
      role: "Admin",
      permissions: ["workorders:site_only"],
      siteId: "site-z",
    });

    expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(addMaterialWithStockDeduction).not.toHaveBeenCalled();
  });

  it("WO tidak ada ditolak tanpa memotong stok", async () => {
    const { service, addMaterialWithStockDeduction } = createService(null);

    const result = await service.addMaterial("wo-x", "barang-1", 1, {
      id: "admin-1",
      role: "Admin",
      permissions: [],
    });

    expect(result).toMatchObject({
      success: false,
      error: "Work order tidak ditemukan",
    });
    expect(addMaterialWithStockDeduction).not.toHaveBeenCalled();
  });
});
