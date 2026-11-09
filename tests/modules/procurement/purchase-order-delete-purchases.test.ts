import { describe, expect, it, vi } from "vitest";

import { PurchaseOrderRepository } from "@/modules/procurement/repositories/PurchaseOrderRepository";
import {
  PurchaseOrderHasPurchasesError,
  PurchaseOrderNotEditableError,
  PurchaseOrderService,
} from "@/modules/procurement/services/PurchaseOrderService";

function createClient({
  purchaseRecordCount = 0,
  purchasedItemCount = 0,
}: { purchaseRecordCount?: number; purchasedItemCount?: number } = {}) {
  const callOrder: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => {
      callOrder.push("lock");
      return [{ poNumber: "PO/2026/11/0001" }];
    }),
    purchaseRecord: {
      count: vi.fn().mockResolvedValue(purchaseRecordCount),
      deleteMany: vi.fn(async () => {
        callOrder.push("deleteVoidedRecords");
      }),
    },
    restockPurchaseLink: {
      updateMany: vi.fn(async () => {
        callOrder.push("revokeLinks");
      }),
    },
    goodsReceipt: { count: vi.fn().mockResolvedValue(0) },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
    purchaseOrderItem: {
      count: vi.fn().mockResolvedValue(purchasedItemCount),
      deleteMany: vi.fn(async () => {
        callOrder.push("deleteItems");
      }),
    },
    purchaseOrderJasaItem: { deleteMany: vi.fn() },
    purchaseRequest: { updateMany: vi.fn() },
    purchaseOrder: {
      delete: vi.fn(async () => {
        callOrder.push("deleteOrder");
      }),
    },
  };
  const client = {
    $transaction: vi.fn(async (work: (inner: typeof tx) => unknown) =>
      work(tx),
    ),
  };
  return { client, tx, callOrder };
}

describe("PurchaseOrderRepository.delete — catatan belanja", () => {
  it("menolak di dalam transaksi bila pesanan sudah punya catatan belanja", async () => {
    const { client, tx } = createClient({ purchaseRecordCount: 2 });

    const outcome = await new PurchaseOrderRepository(client as never).delete(
      "po-1",
    );

    expect(outcome).toBe("HAS_PURCHASES");
    expect(tx.purchaseOrderItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.purchaseRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.purchaseOrder.delete).not.toHaveBeenCalled();
  });

  it("menolak bila ada jumlah dibeli walau catatannya tidak ada", async () => {
    const { client, tx } = createClient({ purchasedItemCount: 1 });

    const outcome = await new PurchaseOrderRepository(client as never).delete(
      "po-1",
    );

    expect(outcome).toBe("HAS_PURCHASES");
    expect(tx.purchaseOrder.delete).not.toHaveBeenCalled();
  });

  it("mengunci baris pesanan sebelum memeriksa lalu menghapus", async () => {
    const { client, tx, callOrder } = createClient();

    const outcome = await new PurchaseOrderRepository(client as never).delete(
      "po-1",
    );

    expect(outcome).toBe("DELETED");
    const lockSql = (tx.$queryRaw.mock.calls[0] as unknown[])[0] as string[];
    expect(lockSql.join("?")).toContain("FOR UPDATE");
    expect(callOrder).toEqual([
      "lock",
      "deleteVoidedRecords",
      "deleteItems",
      "revokeLinks",
      "deleteOrder",
    ]);
  });

  it("catatan yang dibatalkan tidak menghalangi; catatan itu dihapus sebelum item", async () => {
    const { client, tx } = createClient();

    await new PurchaseOrderRepository(client as never).delete("po-1");

    expect(tx.purchaseRecord.count).toHaveBeenCalledWith({
      where: { purchaseOrderId: "po-1", voidedAt: null },
    });
    expect(tx.purchaseRecord.deleteMany).toHaveBeenCalledWith({
      where: { purchaseOrderId: "po-1", voidedAt: { not: null } },
    });
  });

  it("link belanja pengajuan di pesanan ini ikut dicabut", async () => {
    const { client, tx } = createClient();

    await new PurchaseOrderRepository(client as never).delete("po-1");

    expect(tx.restockPurchaseLink.updateMany).toHaveBeenCalledWith({
      where: { revokedAt: null, purchaseRequest: { purchaseOrderId: "po-1" } },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("PurchaseOrderService.delete — catatan belanja", () => {
  it("melempar galat khusus yang tetap tergolong 'tidak bisa diubah'", async () => {
    const poRepo = {
      findById: vi.fn().mockResolvedValue({ id: "po-1", status: "ORDERED" }),
      delete: vi.fn().mockResolvedValue("HAS_PURCHASES"),
    };
    const service = new PurchaseOrderService(
      poRepo as never,
      {} as never,
      {} as never,
    );

    const failure = service.delete("po-1");
    await expect(failure).rejects.toBeInstanceOf(
      PurchaseOrderHasPurchasesError,
    );
    await expect(failure).rejects.toBeInstanceOf(PurchaseOrderNotEditableError);
  });
});
