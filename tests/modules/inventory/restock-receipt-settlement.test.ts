import { describe, expect, it } from "vitest";

import { canCancelUnfulfilledOrder } from "@/modules/inventory/services/restock-receipt-settlement";

const untouchedOrder = {
  purchaseOrderStatus: "ORDERED",
  items: [
    {
      id: "poi-1",
      barangId: "barang-1",
      quantity: 5,
      receivedQuantity: 0,
      cancelledQuantity: 0,
      purchasedQuantity: 0,
    },
  ],
  linkedRequestCount: 1,
  jasaItemCount: 0,
  goodsReceiptCount: 0,
  paymentStatus: "UNPAID",
};

describe("canCancelUnfulfilledOrder — barang yang sudah dibeli", () => {
  it("membatalkan pesanan yang belum disentuh sama sekali", () => {
    expect(canCancelUnfulfilledOrder(untouchedOrder)).toBe(true);
  });

  it("tidak membatalkan pesanan yang barangnya sudah dibeli di toko", () => {
    expect(
      canCancelUnfulfilledOrder({
        ...untouchedOrder,
        items: [{ ...untouchedOrder.items[0], purchasedQuantity: 2 }],
      }),
    ).toBe(false);
  });
});
