import { describe, expect, it, vi } from "vitest";

import { PurchaseOrderRepository } from "@/modules/procurement/repositories/PurchaseOrderRepository";
import {
  PurchaseOrderHasPurchasesError,
  PurchaseOrderNotEditableError,
  PurchaseOrderService,
} from "@/modules/procurement/services/PurchaseOrderService";

interface DeleteFixture {
  purchaseRecordCount?: number;
  goodsReceiptCount?: number;
}

/**
 * Klien transaksi palsu untuk `PurchaseOrderRepository.delete`. Hanya model
 * yang memang boleh disentuh penghapusan PO yang disediakan: tulisan ke tabel
 * belanja atau link belanja akan gagal karena modelnya tidak ada.
 */
function createClient({
  purchaseRecordCount = 0,
  goodsReceiptCount = 0,
}: DeleteFixture = {}) {
  const callOrder: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => {
      callOrder.push("lock");
      return [{ poNumber: "PO/2026/11/0001" }];
    }),
    purchaseRecord: { count: vi.fn().mockResolvedValue(purchaseRecordCount) },
    goodsReceipt: { count: vi.fn().mockResolvedValue(goodsReceiptCount) },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
    purchaseOrderItem: {
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

describe("PurchaseOrderRepository.delete — catatan belanja lama", () => {
  it("menolak di dalam transaksi bila pesanan punya catatan belanja apa pun", async () => {
    const { client, tx } = createClient({ purchaseRecordCount: 1 });

    const outcome = await new PurchaseOrderRepository(client as never).delete(
      "po-1",
    );

    expect(outcome).toBe("HAS_PURCHASES");
    // Catatan yang sudah dibatalkan pun dihitung: FK RESTRICT ke PO dan item
    // PO tetap menahannya, dan catatan itu tidak dihapus demi jejak audit.
    expect(tx.purchaseRecord.count).toHaveBeenCalledWith({
      where: { purchaseOrderId: "po-1" },
    });
    expect(tx.purchaseOrderItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.purchaseRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.purchaseOrder.delete).not.toHaveBeenCalled();
  });

  it("menolak pesanan yang sudah punya GRN tanpa menghapus apa pun", async () => {
    const { client, tx } = createClient({ goodsReceiptCount: 1 });

    const outcome = await new PurchaseOrderRepository(client as never).delete(
      "po-1",
    );

    expect(outcome).toBe("HAS_GOODS_RECEIPTS");
    expect(tx.purchaseOrderItem.deleteMany).not.toHaveBeenCalled();
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
    expect(callOrder).toEqual(["lock", "deleteItems", "deleteOrder"]);
  });

  it("mengembalikan pengajuan yang masih terbuka ke APPROVED", async () => {
    const { client, tx } = createClient();

    await new PurchaseOrderRepository(client as never).delete("po-1");

    expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: {
        purchaseOrderId: "po-1",
        status: { in: ["APPROVED", "ORDERED"] },
      },
      data: { status: "APPROVED", purchaseOrderId: null },
    });
  });
});

describe("PurchaseOrderService.delete — penolakan", () => {
  function createService(outcome: string): PurchaseOrderService {
    const poRepo = {
      findById: vi.fn().mockResolvedValue({ id: "po-1", status: "ORDERED" }),
      delete: vi.fn().mockResolvedValue(outcome),
    };
    return new PurchaseOrderService(poRepo as never, {} as never, {} as never);
  }

  it("catatan belanja lama: galat khusus yang tetap tergolong 'tidak bisa diubah'", async () => {
    const failure = createService("HAS_PURCHASES").delete("po-1");

    await expect(failure).rejects.toBeInstanceOf(
      PurchaseOrderHasPurchasesError,
    );
    await expect(failure).rejects.toBeInstanceOf(PurchaseOrderNotEditableError);
    await expect(failure).rejects.toThrow(
      "Pesanan ini punya catatan belanja lama, jadi tidak bisa dihapus. Batalkan pengajuannya saja.",
    );
  });

  it("GRN: 'tidak bisa diubah' (409), bukan galat server", async () => {
    const failure = createService("HAS_GOODS_RECEIPTS").delete("po-1");

    await expect(failure).rejects.toBeInstanceOf(PurchaseOrderNotEditableError);
    await expect(failure).rejects.toThrow("GRN");
  });
});
