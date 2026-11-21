import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreatePurchaseOrderInput } from "@/modules/procurement/domain/ports/IProcurementRepository";
import { PurchaseRequestAlreadyOrderedError } from "@/modules/procurement/domain/purchase-request-errors";
import { ProcurementRepository } from "@/modules/procurement/repositories/ProcurementRepository";
import { prismaMock } from "@/tests/setup";

/** Input PO untuk pengajuan `prIds`; supplier sengaja kosong. */
function createOrderInput(prIds: string[]): CreatePurchaseOrderInput {
  return {
    id: "po-1",
    poNumber: "PO/2026/11/0001",
    supplierId: null,
    createdBy: "user-1",
    tenantId: "tenant-1",
    totalAmount: 1000,
    items: [
      {
        id: "poi-1",
        barangId: "barang-1",
        quantity: 10,
        unitPrice: 100,
        totalPrice: 1000,
        tenantId: "tenant-1",
      },
    ],
    jasaItems: [],
    prIds,
  };
}

describe("ProcurementRepository.createPOWithItems — klaim pengajuan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.purchaseOrder.create.mockResolvedValue({
      id: "po-1",
      poNumber: "PO/2026/11/0001",
      items: [],
      jasaItems: [],
    });
  });

  it("mengklaim pengajuan APPROVED tanpa PO sebelum membuat PO", async () => {
    prismaMock.purchaseRequest.updateMany.mockResolvedValue({ count: 2 });

    await new ProcurementRepository().createPOWithItems(
      createOrderInput(["pr-1", "pr-2"]),
    );

    expect(prismaMock.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["pr-1", "pr-2"] },
        status: "APPROVED",
        purchaseOrderId: null,
      },
      data: { status: "ORDERED" },
    });
    const [claimOrder] =
      prismaMock.purchaseRequest.updateMany.mock.invocationCallOrder;
    const [createOrder] =
      prismaMock.purchaseOrder.create.mock.invocationCallOrder;
    expect(claimOrder).toBeLessThan(createOrder);
    expect(prismaMock.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          purchaseRequests: { connect: [{ id: "pr-1" }, { id: "pr-2" }] },
        }),
      }),
    );
  });

  it("tidak membuat PO bila ada pengajuan yang sudah diklaim pesanan lain", async () => {
    prismaMock.purchaseRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      new ProcurementRepository().createPOWithItems(
        createOrderInput(["pr-1", "pr-2"]),
      ),
    ).rejects.toBeInstanceOf(PurchaseRequestAlreadyOrderedError);
    expect(prismaMock.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it("id pengajuan yang berulang dihitung sekali", async () => {
    prismaMock.purchaseRequest.updateMany.mockResolvedValue({ count: 1 });

    await new ProcurementRepository().createPOWithItems(
      createOrderInput(["pr-1", "pr-1"]),
    );

    expect(prismaMock.purchaseOrder.create).toHaveBeenCalledTimes(1);
  });
});
