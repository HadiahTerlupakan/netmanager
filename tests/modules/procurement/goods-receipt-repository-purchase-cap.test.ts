import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const callOrder: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => {
      callOrder.push("lock");
      return [{ id: "po-1" }];
    }),
    $executeRaw: vi.fn(async () => {
      callOrder.push("capped-update");
      return 1;
    }),
    goodsReceipt: {
      create: vi.fn(async () => {
        callOrder.push("grn");
        return {
          id: "grn-1",
          grnNumber: "GRN-1",
          purchaseOrderId: "po-1",
          gudangId: "g-1",
          receivedById: "user-1",
          receivedAt: new Date("2026-11-09T03:00:00Z"),
          status: "POSTED",
          notes: null,
          fotoBukti: [],
          createdAt: new Date("2026-11-09T03:00:00Z"),
          updatedAt: new Date("2026-11-09T03:00:00Z"),
          tenantId: "tenant-1",
          items: [],
        };
      }),
    },
    purchaseOrderItem: {
      update: vi.fn(async () => {
        callOrder.push("update");
        return {};
      }),
    },
    barangGudang: { upsert: vi.fn() },
    barangMasuk: { create: vi.fn() },
    purchaseOrder: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  };
  return {
    callOrder,
    tx,
    $transaction: vi.fn(async (work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.$transaction },
}));

import { GoodsReceiptExceedsPurchasedError } from "@/modules/procurement/domain/goods-receipt-errors";
import { GoodsReceiptRepository } from "@/modules/procurement/repositories/GoodsReceiptRepository";

const input = {
  grnNumber: "GRN-1",
  purchaseOrderId: "po-1",
  gudangId: "g-1",
  receivedById: "user-1",
  tenantId: "tenant-1",
  items: [{ purchaseOrderItemId: "poi-1", barangId: "b-1", quantity: 3 }],
};

describe("GoodsReceiptRepository.createAndPost — batas sudah dibeli", () => {
  beforeEach(() => {
    mocks.callOrder.length = 0;
    vi.clearAllMocks();
    mocks.tx.$executeRaw.mockImplementation(async () => {
      mocks.callOrder.push("capped-update");
      return 1;
    });
  });

  it("selalu mengunci pesanan lebih dulu", async () => {
    await new GoodsReceiptRepository().createAndPost(input);

    expect(mocks.callOrder[0]).toBe("lock");
    const lockSql = (mocks.tx.$queryRaw.mock.calls[0] as unknown[])[0] as
      | string[]
      | undefined;
    expect(lockSql?.join("?")).toContain("FOR UPDATE");
    expect(mocks.tx.purchaseOrderItem.update).toHaveBeenCalled();
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("menaikkan jumlah datang secara bersyarat bila dibatasi", async () => {
    await new GoodsReceiptRepository().createAndPost({
      ...input,
      isLimitedToPurchased: true,
    });

    const [sqlParts, ...values] = mocks.tx.$executeRaw.mock
      .calls[0] as unknown as [string[], ...unknown[]];
    expect(sqlParts.join("?")).toContain(
      '"receivedQuantity" + ? <= "purchasedQuantity"',
    );
    expect(values).toEqual([3, "poi-1", 3]);
    expect(mocks.tx.purchaseOrderItem.update).not.toHaveBeenCalled();
  });

  it("menggagalkan seluruh transaksi bila melebihi yang sudah dibeli", async () => {
    mocks.tx.$executeRaw.mockResolvedValue(0);

    await expect(
      new GoodsReceiptRepository().createAndPost({
        ...input,
        isLimitedToPurchased: true,
      }),
    ).rejects.toBeInstanceOf(GoodsReceiptExceedsPurchasedError);
    expect(mocks.tx.barangGudang.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.barangMasuk.create).not.toHaveBeenCalled();
  });
});
