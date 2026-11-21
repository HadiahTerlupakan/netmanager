import { describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type {
  CloseRestockRequestInput,
  RestockOrderSettlement,
  RestockRequestOnlySettlement,
} from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import { RestockGoodsReceiptRepository } from "@/modules/inventory/repositories/RestockGoodsReceiptRepository";

interface DbMock {
  purchaseOrder: { updateMany: Mock; findUnique: Mock };
  purchaseOrderItem: { updateMany: Mock; update: Mock };
  purchaseRequest: { updateMany: Mock; count: Mock };
  purchaseRequestItem: { updateMany: Mock };
  $queryRaw: Mock;
  $transaction: Mock;
}

function createDb(): DbMock {
  const db: DbMock = {
    purchaseOrder: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ id: "po-1" }),
    },
    purchaseOrderItem: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    purchaseRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    purchaseRequestItem: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: "po-1" }]),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(
    async (callback: (tx: DbMock) => unknown) => callback(db),
  );
  return db;
}

const NOT_ENTERED_CANCELLATION = {
  purchaseOrderItemId: "poi-1",
  cancelledQuantity: 4,
  reason: "Tidak dimasukkan ke gudang",
  expected: { quantity: 10, receivedQuantity: 6, cancelledQuantity: 0 },
};

/** Penutupan pengajuan pr-1 di pesanan po-1 dengan dua rencana. */
function closeInput(
  overrides: {
    ifOtherRequestsOpen?: RestockRequestOnlySettlement;
    settlement?: RestockOrderSettlement;
    cancellations?: CloseRestockRequestInput["ifLastOpenRequest"]["cancellations"];
    cancelReason?: string;
    cancelledAt?: Date;
  } = {},
): CloseRestockRequestInput {
  return {
    purchaseOrderId: "po-1",
    purchaseRequestId: "pr-1",
    ifOtherRequestsOpen: overrides.ifOtherRequestsOpen ?? "SETTLE_REQUEST",
    ifLastOpenRequest: {
      settlement: overrides.settlement ?? "SETTLE_ORDER",
      cancellations: overrides.cancellations ?? [NOT_ENTERED_CANCELLATION],
    },
    actorId: "user-1",
    cancelledAt: overrides.cancelledAt ?? new Date("2026-11-21T00:00:00Z"),
    cancelReason: overrides.cancelReason,
  };
}

const OPEN_REQUEST = {
  status: { notIn: ["RECEIVED", "CANCELLED", "REJECTED"] },
};
/** Syarat penulisan status pengajuan pr-1: masih terbuka dan masih memakai po-1. */
const THIS_OPEN_REQUEST = {
  id: "pr-1",
  purchaseOrderId: "po-1",
  ...OPEN_REQUEST,
};

describe("RestockGoodsReceiptRepository — menutup pengajuan", () => {
  it("mengunci baris pesanan, lalu membaca pengajuan lain yang terbuka, baru menyentuh item atau status", async () => {
    const db = createDb();
    const callOrder: string[] = [];
    db.$queryRaw.mockImplementation(async () => {
      callOrder.push("lockOrder");
      return [{ id: "po-1" }];
    });
    db.purchaseRequest.count.mockImplementation(async () => {
      callOrder.push("otherOpenRequests");
      return 0;
    });
    db.purchaseOrderItem.updateMany.mockImplementation(async () => {
      callOrder.push("items");
      return { count: 1 };
    });
    db.purchaseOrder.updateMany.mockImplementation(async () => {
      callOrder.push("order");
      return { count: 1 };
    });

    await new RestockGoodsReceiptRepository(db as never).closeRequest(
      closeInput(),
    );

    expect(callOrder).toEqual([
      "lockOrder",
      "otherOpenRequests",
      "items",
      "order",
    ]);
    const lockSql = (db.$queryRaw.mock.calls[0] as unknown[])[0] as string[];
    expect(lockSql.join("?")).toMatch(/FROM purchase_orders .*FOR UPDATE/s);
    expect(db.purchaseRequest.count).toHaveBeenCalledWith({
      where: {
        purchaseOrderId: "po-1",
        id: { not: "pr-1" },
        ...OPEN_REQUEST,
      },
    });
  });

  it("pengajuan terakhir yang terbuka mencoret sisa hanya bila angka item masih sama dengan snapshot", async () => {
    const db = createDb();
    const cancelledAt = new Date("2026-11-21T00:00:00Z");

    const result = await new RestockGoodsReceiptRepository(
      db as never,
    ).closeRequest(closeInput({ cancelledAt }));

    expect(result).toEqual({ isWritten: true, isLastOpenRequest: true });
    expect(db.purchaseOrderItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: "poi-1",
        purchaseOrderId: "po-1",
        quantity: 10,
        receivedQuantity: 6,
        cancelledQuantity: 0,
      },
      data: {
        cancelledQuantity: { increment: 4 },
        cancelReason: "Tidak dimasukkan ke gudang",
        cancelledAt,
      },
    });
  });

  it("selama pesanan masih dipakai pengajuan lain yang terbuka: tidak mencoret apa pun dan hanya menyelesaikan pengajuan ini", async () => {
    const db = createDb();
    db.purchaseRequest.count.mockResolvedValue(1);

    const result = await new RestockGoodsReceiptRepository(
      db as never,
    ).closeRequest(closeInput());

    expect(result).toEqual({ isWritten: true, isLastOpenRequest: false });
    expect(db.purchaseOrderItem.updateMany).not.toHaveBeenCalled();
    expect(db.purchaseOrder.updateMany).not.toHaveBeenCalled();
    expect(db.purchaseRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(db.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: THIS_OPEN_REQUEST,
      data: { status: "RECEIVED" },
    });
  });

  it("selama pesanan masih dipakai pengajuan lain yang terbuka: Batalkan hanya membatalkan pengajuan ini beserta alasannya", async () => {
    const db = createDb();
    db.purchaseRequest.count.mockResolvedValue(2);

    const result = await new RestockGoodsReceiptRepository(
      db as never,
    ).closeRequest(
      closeInput({
        ifOtherRequestsOpen: "CANCEL_REQUEST",
        settlement: "CANCEL_REQUEST_AND_SETTLE_ORDER",
        cancelReason: "Salah gudang",
      }),
    );

    expect(result).toEqual({ isWritten: true, isLastOpenRequest: false });
    expect(db.purchaseOrderItem.updateMany).not.toHaveBeenCalled();
    expect(db.purchaseOrder.updateMany).not.toHaveBeenCalled();
    expect(db.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: THIS_OPEN_REQUEST,
      data: { status: "CANCELLED", cancelReason: "Salah gudang" },
    });
  });

  it("pengajuan terakhir menutup pesanan dan hanya pengajuan ini; pengajuan lain tidak pernah disentuh", async () => {
    const db = createDb();

    await new RestockGoodsReceiptRepository(db as never).closeRequest(
      closeInput({ cancellations: [] }),
    );

    expect(db.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "po-1", status: { notIn: ["RECEIVED", "CANCELLED"] } },
      data: { status: "RECEIVED", receivedById: "user-1" },
    });
    expect(db.purchaseRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(db.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: THIS_OPEN_REQUEST,
      data: { status: "RECEIVED" },
    });
  });

  it("membatalkan pesanan hanya bila belum ada barang masuk, jasa, pembayaran, maupun catatan belanja lama", async () => {
    const db = createDb();

    const result = await new RestockGoodsReceiptRepository(
      db as never,
    ).closeRequest(
      closeInput({
        ifOtherRequestsOpen: "CANCEL_REQUEST",
        settlement: "CANCEL_ORDER",
        cancelReason: "Tidak jadi dibutuhkan",
      }),
    );

    expect(result).toEqual({ isWritten: true, isLastOpenRequest: true });
    expect(db.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: "po-1",
        status: { in: ["DRAFT", "ORDERED"] },
        paymentStatus: "UNPAID",
        goodsReceipts: { none: {} },
        jasaItems: { none: {} },
        purchaseRecords: { none: { voidedAt: null } },
        items: { none: { receivedQuantity: { gt: 0 } } },
      },
      data: { status: "CANCELLED" },
    });
    expect(db.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: THIS_OPEN_REQUEST,
      data: { status: "CANCELLED", cancelReason: "Tidak jadi dibutuhkan" },
    });
  });

  it("membatalkan pengajuan dulu, lalu menutup pesanan yang tidak boleh ikut dibatalkan", async () => {
    const db = createDb();
    const callOrder: string[] = [];
    db.purchaseRequest.updateMany.mockImplementation(
      async ({ data }: { data: { status: string } }) => {
        callOrder.push(`request:${data.status}`);
        return { count: 1 };
      },
    );
    db.purchaseOrder.updateMany.mockImplementation(async () => {
      callOrder.push("order:RECEIVED");
      return { count: 1 };
    });

    await new RestockGoodsReceiptRepository(db as never).closeRequest(
      closeInput({
        ifOtherRequestsOpen: "CANCEL_REQUEST",
        settlement: "CANCEL_REQUEST_AND_SETTLE_ORDER",
        cancelReason: "Salah gudang",
      }),
    );

    expect(callOrder).toEqual(["request:CANCELLED", "order:RECEIVED"]);
  });

  it("mengembalikan isWritten false tanpa menulis status bila item sudah berubah sejak dibaca", async () => {
    const db = createDb();
    db.purchaseOrderItem.updateMany.mockResolvedValue({ count: 0 });

    const result = await new RestockGoodsReceiptRepository(
      db as never,
    ).closeRequest(closeInput({ settlement: "CANCEL_ORDER" }));

    expect(result).toEqual({ isWritten: false });
    expect(db.purchaseOrder.updateMany).not.toHaveBeenCalled();
    expect(db.purchaseRequest.updateMany).not.toHaveBeenCalled();
  });

  it("mengembalikan isWritten false bila pesanan sudah tidak bisa dibatalkan", async () => {
    const db = createDb();
    db.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });

    const result = await new RestockGoodsReceiptRepository(
      db as never,
    ).closeRequest(
      closeInput({ settlement: "CANCEL_ORDER", cancellations: [] }),
    );

    expect(result).toEqual({ isWritten: false });
    expect(db.purchaseRequest.updateMany).not.toHaveBeenCalled();
  });

  it.each<[string, RestockRequestOnlySettlement, number]>([
    [
      "sudah ditutup atau lepas dari pesanan saat diselesaikan",
      "SETTLE_REQUEST",
      1,
    ],
    [
      "sudah ditutup atau lepas dari pesanan saat dibatalkan",
      "CANCEL_REQUEST",
      1,
    ],
    [
      "sudah ditutup sebelum pengajuan terakhir menutup pesanannya",
      "SETTLE_REQUEST",
      0,
    ],
  ])(
    "membatalkan seluruh penutupan bila pengajuan ini %s",
    async (_label, ifOtherRequestsOpen, otherOpenRequests) => {
      const db = createDb();
      db.purchaseRequest.count.mockResolvedValue(otherOpenRequests);
      db.purchaseRequest.updateMany.mockResolvedValue({ count: 0 });

      const result = await new RestockGoodsReceiptRepository(
        db as never,
      ).closeRequest(closeInput({ ifOtherRequestsOpen, cancellations: [] }));

      expect(result).toEqual({ isWritten: false });
    },
  );
});

describe("RestockGoodsReceiptRepository — batal tanpa pesanan", () => {
  it("membatalkan pengajuan yang disetujui dan belum punya pesanan, beserta alasannya", async () => {
    const db = createDb();

    const isCancelled = await new RestockGoodsReceiptRepository(
      db as never,
    ).cancelRequestWithoutOrder({
      purchaseRequestId: "pr-1",
      tenantId: "tenant-1",
      cancelReason: "Tidak jadi dibutuhkan",
    });

    expect(isCancelled).toBe(true);
    expect(db.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "pr-1",
        tenantId: "tenant-1",
        status: { in: ["APPROVED", "ORDERED"] },
        purchaseOrderId: null,
      },
      data: { status: "CANCELLED", cancelReason: "Tidak jadi dibutuhkan" },
    });
  });

  it("mengembalikan false bila statusnya berubah atau pesanannya baru dibuat", async () => {
    const db = createDb();
    db.purchaseRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      new RestockGoodsReceiptRepository(db as never).cancelRequestWithoutOrder({
        purchaseRequestId: "pr-1",
        tenantId: "tenant-1",
        cancelReason: "Tidak jadi dibutuhkan",
      }),
    ).resolves.toBe(false);
  });
});

describe("RestockGoodsReceiptRepository — ganti barang", () => {
  it("mengisi barang yang semula diajukan hanya bila belum diisi persetujuan atasan", async () => {
    const db = createDb();

    await new RestockGoodsReceiptRepository(db as never).applyItemSubstitutions(
      {
        purchaseOrderId: "po-1",
        tenantId: "tenant-1",
        substitutions: [
          {
            purchaseOrderItemId: "poi-1",
            fromBarangId: "b-1",
            toBarangId: "b-9",
          },
        ],
      },
    );

    const orderedLines = {
      barangId: "b-1",
      statusApproval: { not: "REJECTED" },
      purchaseRequest: { purchaseOrderId: "po-1", tenantId: "tenant-1" },
    };
    expect(db.purchaseOrderItem.update).toHaveBeenCalledWith({
      where: { id: "poi-1" },
      data: { barangId: "b-9" },
    });
    expect(db.purchaseRequestItem.updateMany).toHaveBeenNthCalledWith(1, {
      where: { ...orderedLines, barangIdDiminta: null },
      data: { barangId: "b-9", barangIdDiminta: "b-1" },
    });
    expect(db.purchaseRequestItem.updateMany).toHaveBeenNthCalledWith(2, {
      where: { ...orderedLines, barangIdDiminta: { not: null } },
      data: { barangId: "b-9" },
    });
  });
});
