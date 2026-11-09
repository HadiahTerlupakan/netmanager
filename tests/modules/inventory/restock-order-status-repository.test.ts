import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { RestockGoodsReceiptRepository } from "@/modules/inventory/repositories/RestockGoodsReceiptRepository";

describe("RestockGoodsReceiptRepository — status pesanan", () => {
  function createDb() {
    const db = {
      purchaseOrder: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: "po-1" }),
      },
      purchaseOrderItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      purchaseRequest: {
        updateMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(2),
      },
      restockPurchaseLink: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "po-1" }]),
      $transaction: vi.fn(),
    };
    db.$transaction.mockImplementation(async (callback) => callback(db));
    return db;
  }

  it.each([
    "applyReceiptSettlement",
    "finishPurchaseOrderWithoutDelivery",
  ] as const)(
    "%s mengunci baris pesanan sebelum menyentuh item, status, atau link",
    async (method) => {
      const db = createDb();
      const callOrder: string[] = [];
      db.$queryRaw.mockImplementation(async () => {
        callOrder.push("lockOrder");
        return [{ id: "po-1" }];
      });
      db.purchaseOrderItem.updateMany.mockImplementation(async () => {
        callOrder.push("items");
        return { count: 1 };
      });
      db.purchaseOrder.updateMany.mockImplementation(async () => {
        callOrder.push("order");
        return { count: 1 };
      });
      db.restockPurchaseLink.updateMany.mockImplementation(async () => {
        callOrder.push("links");
        return { count: 1 };
      });
      const repository = new RestockGoodsReceiptRepository(db as never);
      const input = {
        purchaseOrderId: "po-1",
        purchaseRequestId: "pr-1",
        settlement: "SETTLE_ORDER" as const,
        actorId: "user-1",
        cancelledAt: new Date("2026-11-09T00:00:00Z"),
        cancellations: [
          {
            purchaseOrderItemId: "poi-1",
            cancelledQuantity: 1,
            reason: "Tidak dikirim",
            expected: {
              quantity: 2,
              receivedQuantity: 1,
              cancelledQuantity: 0,
            },
          },
        ],
      };

      await repository[method](input);

      expect(callOrder[0]).toBe("lockOrder");
      expect(callOrder).toContain("links");
      const lockSql = (db.$queryRaw.mock.calls[0] as unknown[])[0] as string[];
      expect(lockSql.join("?")).toMatch(/FROM purchase_orders .*FOR UPDATE/s);
    },
  );

  it("menandai semua pengajuan di pesanan itu selesai, kecuali yang sudah final", async () => {
    const db = createDb();

    await new RestockGoodsReceiptRepository(db as never).applyReceiptSettlement(
      {
        purchaseOrderId: "po-1",
        purchaseRequestId: "pr-1",
        settlement: "SETTLE_ORDER",
        actorId: "user-1",
      },
    );

    expect(db.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: {
        purchaseOrderId: "po-1",
        status: { notIn: ["RECEIVED", "CANCELLED", "REJECTED"] },
      },
      data: { status: "RECEIVED" },
    });
    // Link belanja pengajuan yang kini final dicabut di transaksi yang sama.
    expect(db.restockPurchaseLink.updateMany).toHaveBeenCalledWith({
      where: {
        revokedAt: null,
        purchaseRequest: {
          OR: [{ id: "pr-1" }, { purchaseOrderId: "po-1" }],
          status: { in: ["RECEIVED", "CANCELLED", "REJECTED"] },
        },
      },
      data: { revokedAt: expect.any(Date), revokedById: null },
    });
  });

  it("KEEP_OPEN tidak mencabut link belanja", async () => {
    const db = createDb();

    await new RestockGoodsReceiptRepository(db as never).applyReceiptSettlement(
      {
        purchaseOrderId: "po-1",
        purchaseRequestId: "pr-1",
        settlement: "KEEP_OPEN",
        actorId: "user-1",
      },
    );

    expect(db.restockPurchaseLink.updateMany).not.toHaveBeenCalled();
  });

  it("hanya menyelesaikan pengajuan ini pada SETTLE_REQUEST", async () => {
    const db = createDb();

    await new RestockGoodsReceiptRepository(db as never).applyReceiptSettlement(
      {
        purchaseOrderId: "po-1",
        purchaseRequestId: "pr-1",
        settlement: "SETTLE_REQUEST",
        actorId: "user-1",
      },
    );

    expect(db.purchaseOrder.updateMany).not.toHaveBeenCalled();
    expect(db.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "pr-1",
        status: { notIn: ["RECEIVED", "CANCELLED", "REJECTED"] },
      },
      data: { status: "RECEIVED" },
    });
  });

  it("membatalkan pesanan hanya bila belum ada kiriman, belanja, jasa, maupun pembayaran", async () => {
    const db = createDb();

    const isWritten = await new RestockGoodsReceiptRepository(
      db as never,
    ).finishPurchaseOrderWithoutDelivery({
      purchaseOrderId: "po-1",
      purchaseRequestId: "pr-1",
      settlement: "CANCEL_ORDER",
      actorId: "user-1",
      cancelledAt: new Date(),
      cancellations: [
        {
          purchaseOrderItemId: "poi-1",
          cancelledQuantity: 10,
          reason: "Toko tidak mengirim",
          expected: { quantity: 10, receivedQuantity: 0, cancelledQuantity: 0 },
        },
      ],
    });

    expect(isWritten).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.purchaseOrderItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "poi-1",
          purchaseOrderId: "po-1",
          quantity: 10,
          receivedQuantity: 0,
          cancelledQuantity: 0,
        },
      }),
    );
    expect(db.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: "po-1",
        status: { in: ["DRAFT", "ORDERED"] },
        paymentStatus: "UNPAID",
        goodsReceipts: { none: {} },
        jasaItems: { none: {} },
        purchaseRecords: { none: { voidedAt: null } },
        items: {
          none: {
            OR: [
              { receivedQuantity: { gt: 0 } },
              { purchasedQuantity: { gt: 0 } },
            ],
          },
        },
      },
      data: { status: "CANCELLED" },
    });
    expect(db.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "pr-1",
        status: { notIn: ["RECEIVED", "CANCELLED", "REJECTED"] },
      },
      data: { status: "CANCELLED" },
    });
  });

  it("mengembalikan false bila item sudah berubah sejak dibaca", async () => {
    const db = createDb();
    db.purchaseOrderItem.updateMany.mockResolvedValue({ count: 0 });

    const isWritten = await new RestockGoodsReceiptRepository(
      db as never,
    ).finishPurchaseOrderWithoutDelivery({
      purchaseOrderId: "po-1",
      purchaseRequestId: "pr-1",
      settlement: "CANCEL_ORDER",
      actorId: "user-1",
      cancelledAt: new Date(),
      cancellations: [
        {
          purchaseOrderItemId: "poi-1",
          cancelledQuantity: 10,
          reason: "Toko tidak mengirim",
          expected: { quantity: 10, receivedQuantity: 0, cancelledQuantity: 0 },
        },
      ],
    });

    expect(isWritten).toBe(false);
    expect(db.purchaseOrder.updateMany).not.toHaveBeenCalled();
  });

  it("mengembalikan false bila pesanan sudah tidak bisa dibatalkan", async () => {
    const db = createDb();
    db.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });

    const isWritten = await new RestockGoodsReceiptRepository(
      db as never,
    ).applyReceiptSettlement({
      purchaseOrderId: "po-1",
      purchaseRequestId: "pr-1",
      settlement: "CANCEL_ORDER",
      actorId: "user-1",
    });

    expect(isWritten).toBe(false);
    expect(db.purchaseRequest.updateMany).not.toHaveBeenCalled();
  });
});
