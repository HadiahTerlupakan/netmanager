import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/event-bus", () => ({
  eventBus: { publish: vi.fn().mockResolvedValue(undefined) },
}));

import {
  GoodsReceiptInvalidError,
  GoodsReceiptService,
} from "@/modules/procurement/services/GoodsReceiptService";

function createService(purchaseOrder: Record<string, unknown>) {
  const grnRepo = {
    generateGrnNumber: vi.fn().mockResolvedValue("GRN-001"),
    createAndPost: vi
      .fn()
      .mockResolvedValue({ id: "grn-1", grnNumber: "GRN-001" }),
  };
  const poRepo = {
    findByIdWithRelations: vi.fn().mockResolvedValue({
      id: "po-1",
      poNumber: "PO-1",
      tenantId: "tenant-1",
      status: "PARTIAL",
      ...purchaseOrder,
    }),
  };
  return {
    grnRepo,
    service: new GoodsReceiptService(grnRepo as never, poRepo as never),
  };
}

const kabel = {
  id: "poi-1",
  barangId: "b-1",
  quantity: 10,
  receivedQuantity: 6,
  cancelledQuantity: 0,
  unitPrice: 1000,
  barang: { id: "b-1", nama: "Kabel Fiber" },
};

function createInput(quantity: number) {
  return {
    purchaseOrderId: "po-1",
    gudangId: "g-1",
    receivedById: "user-1",
    tenantId: "tenant-1",
    items: [{ purchaseOrderItemId: "poi-1", barangId: "b-1", quantity }],
  };
}

describe("GoodsReceiptService — sisa yang masih ditunggu", () => {
  it("tidak menerima jumlah yang sudah dinyatakan tidak jadi datang", async () => {
    const { service, grnRepo } = createService({
      items: [{ ...kabel, cancelledQuantity: 2 }],
    });

    await expect(service.create(createInput(3))).rejects.toThrow(
      "melebihi sisa yang masih ditunggu: 2",
    );
    expect(grnRepo.createAndPost).not.toHaveBeenCalled();
  });

  it("menerima sisa yang memang masih ditunggu", async () => {
    const { service, grnRepo } = createService({
      items: [{ ...kabel, cancelledQuantity: 2 }],
    });

    await service.create(createInput(2));

    expect(grnRepo.createAndPost).toHaveBeenCalledTimes(1);
  });

  it("menolak pesanan yang sisanya sudah habis karena tidak jadi datang", async () => {
    const { service } = createService({
      items: [{ ...kabel, cancelledQuantity: 4 }],
    });

    await expect(service.create(createInput(1))).rejects.toThrow(
      GoodsReceiptInvalidError,
    );
  });

  it.each([
    ["RECEIVED", "sudah selesai"],
    ["CANCELLED", "sudah dibatalkan"],
  ])("menolak pesanan berstatus %s", async (status, message) => {
    const { service, grnRepo } = createService({ status, items: [kabel] });

    await expect(service.create(createInput(1))).rejects.toThrow(message);
    expect(grnRepo.createAndPost).not.toHaveBeenCalled();
  });
});
