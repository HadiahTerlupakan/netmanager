import { describe, expect, it } from "vitest";

import type {
  RestockPurchaseOrderForReceipt,
  RestockPurchaseOrderItem,
} from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import {
  canCancelUnfulfilledOrder,
  decideLastRequestCancelSettlement,
  planRemainderCancellations,
  resolveOwnedBarangIds,
} from "@/modules/inventory/services/restock-receipt-settlement";

const kabel: RestockPurchaseOrderItem = {
  id: "poi-1",
  barangId: "barang-1",
  quantity: 10,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  barang: { id: "barang-1", nama: "Kabel Fiber" },
};

/** Pesanan milik satu pengajuan yang belum disentuh sama sekali. */
function untouchedOrder(
  overrides: Partial<RestockPurchaseOrderForReceipt> = {},
): RestockPurchaseOrderForReceipt {
  return {
    id: "po-1",
    status: "ORDERED",
    paymentStatus: "UNPAID",
    jasaItemCount: 0,
    goodsReceiptIds: [],
    hasLegacyPurchases: false,
    items: [kabel],
    ...overrides,
  };
}

describe("canCancelUnfulfilledOrder", () => {
  it("membatalkan pesanan DRAFT atau ORDERED yang belum disentuh sama sekali", () => {
    expect(canCancelUnfulfilledOrder(untouchedOrder(), 1)).toBe(true);
    expect(
      canCancelUnfulfilledOrder(untouchedOrder({ status: "DRAFT" }), 1),
    ).toBe(true);
  });

  it.each([
    [
      "sudah ada barang yang masuk",
      { items: [{ ...kabel, receivedQuantity: 1 }] },
    ],
    ["sudah punya catatan barang masuk", { goodsReceiptIds: ["grn-1"] }],
    ["punya baris jasa", { jasaItemCount: 1 }],
    ["sudah dibayar", { paymentStatus: "PAID" }],
    ["dibayar sebagian", { paymentStatus: "PARTIAL" }],
    ["punya catatan belanja lama", { hasLegacyPurchases: true }],
    ["statusnya sudah selesai", { status: "RECEIVED" }],
  ])("tidak membatalkan pesanan yang %s", (_label, overrides) => {
    expect(canCancelUnfulfilledOrder(untouchedOrder(overrides), 1)).toBe(false);
  });

  it("tidak membatalkan pesanan gabungan", () => {
    expect(canCancelUnfulfilledOrder(untouchedOrder(), 2)).toBe(false);
  });
});

describe("keputusan status penutupan", () => {
  it("Batalkan oleh pengajuan terakhir membatalkan pesanan yang belum disentuh, selain itu menutupnya selesai", () => {
    expect(decideLastRequestCancelSettlement(true)).toBe("CANCEL_ORDER");
    expect(decideLastRequestCancelSettlement(false)).toBe(
      "CANCEL_REQUEST_AND_SETTLE_ORDER",
    );
  });

  it("pesanan milik satu pengajuan dimiliki seluruhnya; gabungan hanya barang di barisnya", () => {
    const request = { lines: [{ barangId: "barang-1", jumlah: 5 }] };

    expect(resolveOwnedBarangIds(request, 1)).toBeNull();
    expect(resolveOwnedBarangIds(request, 2)).toEqual(new Set(["barang-1"]));
  });
});

describe("planRemainderCancellations", () => {
  it("mencoret seluruh sisa dengan snapshot yang sama dengan isi pesanan", () => {
    const planned = planRemainderCancellations({
      items: [{ ...kabel, receivedQuantity: 2, cancelledQuantity: 1 }],
      reason: "Tidak jadi dibutuhkan",
    });

    expect(planned.map((entry) => entry.cancellation)).toEqual([
      {
        purchaseOrderItemId: "poi-1",
        cancelledQuantity: 7,
        reason: "Tidak jadi dibutuhkan",
        expected: { quantity: 10, receivedQuantity: 2, cancelledQuantity: 1 },
      },
    ]);
    expect(planned[0]?.item.barang?.nama).toBe("Kabel Fiber");
  });

  it("memperhitungkan barang yang baru masuk dan kelebihan yang baru dinaikkan", () => {
    const konektor: RestockPurchaseOrderItem = {
      ...kabel,
      id: "poi-2",
      barangId: "barang-2",
      quantity: 5,
    };

    const planned = planRemainderCancellations({
      items: [kabel, konektor],
      reason: "Tidak sampai",
      enteredByItemId: new Map([
        ["poi-1", 6],
        ["poi-2", 7],
      ]),
      extraByItemId: new Map([["poi-2", 2]]),
    });

    expect(planned.map((entry) => entry.cancellation)).toEqual([
      {
        purchaseOrderItemId: "poi-1",
        cancelledQuantity: 4,
        reason: "Tidak sampai",
        expected: { quantity: 10, receivedQuantity: 6, cancelledQuantity: 0 },
      },
    ]);
  });

  it("tidak mencoret item yang sudah tidak punya sisa", () => {
    expect(
      planRemainderCancellations({
        items: [{ ...kabel, receivedQuantity: 4, cancelledQuantity: 6 }],
        reason: "Alasan",
      }),
    ).toEqual([]);
  });
});
