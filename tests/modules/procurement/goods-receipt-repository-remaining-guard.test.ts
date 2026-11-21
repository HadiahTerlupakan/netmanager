import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const callOrder: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => {
      callOrder.push("lock");
      return [{ id: "po-1" }];
    }),
    $executeRaw: vi.fn(async () => {
      callOrder.push("guarded-update");
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
          receivedAt: new Date("2026-11-21T03:00:00Z"),
          status: "POSTED",
          notes: null,
          fotoBukti: [],
          createdAt: new Date("2026-11-21T03:00:00Z"),
          updatedAt: new Date("2026-11-21T03:00:00Z"),
          tenantId: "tenant-1",
          items: [],
        };
      }),
    },
    purchaseOrderItem: { update: vi.fn() },
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

import { GoodsReceiptExceedsRemainingError } from "@/modules/procurement/domain/goods-receipt-errors";
import type { GoodsReceiptCreateInput } from "@/modules/procurement/domain/ports/IGoodsReceiptRepository";
import { GoodsReceiptRepository } from "@/modules/procurement/repositories/GoodsReceiptRepository";

const input: GoodsReceiptCreateInput = {
  grnNumber: "GRN-1",
  purchaseOrderId: "po-1",
  gudangId: "g-1",
  receivedById: "user-1",
  tenantId: "tenant-1",
  items: [{ purchaseOrderItemId: "poi-1", barangId: "b-1", quantity: 3 }],
};

/** SQL dan nilai parameter dari panggilan `$executeRaw` ke-`index`. */
function readGuardedUpdate(index = 0): { sql: string; values: unknown[] } {
  const [sqlParts, ...values] = mocks.tx.$executeRaw.mock.calls[
    index
  ] as unknown as [string[], ...unknown[]];
  return { sql: sqlParts.join("?"), values };
}

describe("GoodsReceiptRepository.createAndPost — penjaga sisa pesanan", () => {
  beforeEach(() => {
    mocks.callOrder.length = 0;
    vi.clearAllMocks();
    mocks.tx.$executeRaw.mockImplementation(async () => {
      mocks.callOrder.push("guarded-update");
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
  });

  it("selalu menaikkan jumlah masuk lewat UPDATE bersyarat sisa pesanan", async () => {
    await new GoodsReceiptRepository().createAndPost(input);

    const { sql, values } = readGuardedUpdate();
    expect(sql).toContain(
      '"receivedQuantity" + ? <= "quantity" - "cancelledQuantity"',
    );
    expect(sql).toContain('"purchaseOrderId" = ?');
    expect(values).toEqual([3, "poi-1", "po-1", 3]);
    expect(mocks.tx.purchaseOrderItem.update).not.toHaveBeenCalled();
  });

  it("menjaga setiap baris, termasuk barang yang sama dua kali", async () => {
    await new GoodsReceiptRepository().createAndPost({
      ...input,
      items: [
        { purchaseOrderItemId: "poi-1", barangId: "b-1", quantity: 2 },
        { purchaseOrderItemId: "poi-1", barangId: "b-1", quantity: 1 },
      ],
    });

    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(readGuardedUpdate(1).values).toEqual([1, "poi-1", "po-1", 1]);
  });

  it("menggagalkan seluruh transaksi bila jumlah masuk melebihi sisa", async () => {
    mocks.tx.$executeRaw.mockResolvedValue(0);

    const attempt = new GoodsReceiptRepository().createAndPost(input);

    await expect(attempt).rejects.toBeInstanceOf(
      GoodsReceiptExceedsRemainingError,
    );
    await expect(attempt).rejects.toMatchObject({
      purchaseOrderItemId: "poi-1",
    });
    expect(mocks.tx.barangGudang.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.barangMasuk.create).not.toHaveBeenCalled();
    expect(mocks.tx.purchaseOrder.update).not.toHaveBeenCalled();
  });
});
