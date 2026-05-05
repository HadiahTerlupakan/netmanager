import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkOrderStatus, type PrismaClient } from "@prisma/client";

import { prismaMock } from "../../setup";
import { WorkOrderMaterialRepository } from "@/modules/work-order/repositories/WorkOrderMaterialRepository";
import { WorkOrderService } from "@/modules/work-order/services/WorkOrderService";

const sideEffectMocks = vi.hoisted(() => ({
  invalidateWorkOrderCaches: vi.fn().mockResolvedValue(undefined),
  logMobileMaterialReturnActivity: vi.fn(),
  notifyMobileWorkOrderMaterialReturnSafely: vi
    .fn()
    .mockResolvedValue(undefined),
}));

vi.mock("@/modules/work-order/services/work-order-side-effects", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/work-order/services/work-order-side-effects")
  >("@/modules/work-order/services/work-order-side-effects");

  return {
    ...actual,
    invalidateWorkOrderCaches: sideEffectMocks.invalidateWorkOrderCaches,
    logMobileMaterialReturnActivity:
      sideEffectMocks.logMobileMaterialReturnActivity,
    notifyMobileWorkOrderMaterialReturnSafely:
      sideEffectMocks.notifyMobileWorkOrderMaterialReturnSafely,
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Work order material SQL table mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback: unknown) => {
      if (typeof callback === "function") {
        return (callback as (tx: typeof prismaMock) => unknown)(prismaMock);
      }

      return Promise.resolve(callback);
    });
  });

  it("uses the mapped work_orders table when appending used materials", async () => {
    const repository = new WorkOrderMaterialRepository(
      prismaMock as unknown as PrismaClient,
    );

    prismaMock.barangGudang.findFirst.mockResolvedValue({
      id: "barang-gudang-1",
      barangId: "barang-1",
      gudangId: "gudang-1",
      tenantId: "tenant-1",
      stok: 10,
      stokBaru: 10,
      stokBekas: 4,
      stokRusak: 1,
      barang: {
        nama: "Kabel Dropcore",
        satuan: "pcs",
      },
    });
    prismaMock.barangGudang.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.barangKeluar.create.mockResolvedValue({
      id: "keluar-1",
      barang: {
        nama: "Kabel Dropcore",
        satuan: "pcs",
      },
    });
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.workOrders.findUnique.mockResolvedValue({
      usedMaterials: [],
    });
    prismaMock.workOrderUpdates.create.mockResolvedValue({ id: "update-1" });

    await repository.addMobileMaterialsWithStockDeduction({
      workOrder: {
        id: "wo-1",
        tenantId: "tenant-1",
        workOrderNumber: "WO-001",
        title: "Pasang ONU",
        status: WorkOrderStatus.IN_PROGRESS,
      },
      items: [
        {
          barangId: "barang-1",
          gudangId: "gudang-1",
          jumlah: 2,
          kondisi: "BARU",
        },
      ],
      actorId: "user-1",
    });

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    const [sqlTemplate] = prismaMock.$executeRaw.mock.calls[0];
    expect(sqlTemplate.join(" ")).toContain('UPDATE "work_orders"');
  });

  it("uses the mapped work_orders table when appending returned materials", async () => {
    const service = new WorkOrderService(prismaMock as unknown as PrismaClient);

    const readService = (service as unknown as Record<string, unknown>)
      .readService as { getWorkOrderById: ReturnType<typeof vi.fn> };

    readService.getWorkOrderById = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: "wo-1",
        tenantId: "tenant-1",
        workOrderNumber: "WO-001",
        title: "Pasang ONU",
        status: WorkOrderStatus.IN_PROGRESS,
        assignedToId: "user-1",
        assignments: [],
        departmentId: null,
        siteId: null,
      },
    });

    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.workOrderUpdates.create.mockResolvedValue({ id: "update-1" });

    const result = await service.returnMobileMaterials(
      "wo-1",
      [
        {
          barangId: "barang-1",
          gudangId: "gudang-1",
          jumlah: 1,
          kondisi: "BEKAS",
        },
      ],
      {
        id: "user-1",
        tenantId: "tenant-1",
        role: "SUPER_ADMIN",
      },
    );

    expect(result.success).toBe(false);
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    expect(result.code).toBe("NOT_FOUND");
  });
});
