import { describe, expect, it, vi } from "vitest";

import { RestockGoodsReceiptRepository } from "@/modules/inventory/repositories/RestockGoodsReceiptRepository";

function createDb(purchaseOrder: Record<string, unknown>) {
  const items = [
    { id: "poi-1", quantity: 10, unitPrice: 1000 },
    { id: "poi-2", quantity: 5, unitPrice: 2000 },
  ];
  const tx = {
    purchaseOrderItem: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        items.find((item) => item.id === where.id),
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { quantity: number };
        }) => {
          const item = items.find((candidate) => candidate.id === where.id)!;
          item.quantity = data.quantity;
          return item;
        },
      ),
      findMany: vi.fn(async () => items),
    },
    purchaseOrderJasaItem: {
      findMany: vi.fn(async () => [{ quantity: 1, unitPrice: 500 }]),
    },
    purchaseOrder: {
      findUnique: vi.fn(async () => purchaseOrder),
      update: vi.fn(),
    },
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return { db, tx };
}

describe("RestockGoodsReceiptRepository.increaseItemQuantities", () => {
  it("raises the item and recalculates the PO totals with PPN", async () => {
    const { db, tx } = createDb({
      id: "po-1",
      ppnRate: 11,
      paymentStatus: "UNPAID",
      grandTotal: 22755,
    });

    await new RestockGoodsReceiptRepository(db as never).increaseItemQuantities(
      {
        purchaseOrderId: "po-1",
        increases: [{ purchaseOrderItemId: "poi-1", extraQuantity: 10 }],
      },
    );

    expect(tx.purchaseOrderItem.update).toHaveBeenCalledWith({
      where: { id: "poi-1" },
      data: { quantity: 20, totalPrice: 20000 },
    });
    // 20×1000 + 5×2000 + jasa 500 = 30500, PPN 11% = 3355.
    expect(tx.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "po-1" },
      data: { totalAmount: 30500, ppnAmount: 3355, grandTotal: 33855 },
    });
  });

  it("marks a paid PO as partially paid once its total grows", async () => {
    const { db, tx } = createDb({
      id: "po-1",
      ppnRate: 0,
      paymentStatus: "PAID",
      grandTotal: 20500,
    });

    await new RestockGoodsReceiptRepository(db as never).increaseItemQuantities(
      {
        purchaseOrderId: "po-1",
        increases: [{ purchaseOrderItemId: "poi-2", extraQuantity: 1 }],
      },
    );

    expect(tx.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "po-1" },
      data: {
        totalAmount: 22500,
        ppnAmount: 0,
        grandTotal: 22500,
        paymentStatus: "PARTIAL",
      },
    });
  });
});
