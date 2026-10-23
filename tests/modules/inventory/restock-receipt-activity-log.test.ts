import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logActivitySafe: vi.fn(),
  createGoodsReceipt: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: mocks.logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/procurement", () => {
  class PurchaseOrderNotFoundError extends Error {}
  class GoodsReceiptInvalidError extends Error {}
  return {
    getGoodsReceiptService: () => ({ create: mocks.createGoodsReceipt }),
    GoodsReceiptInvalidError,
    PurchaseOrderNotFoundError,
    ProcurementService: class {},
  };
});

import { RestockGoodsReceiptService } from "@/modules/inventory/services/RestockGoodsReceiptService";

function createService() {
  const repository = {
    findPurchaseRequestForReceipt: vi.fn().mockResolvedValue({
      id: "pr-1",
      nomorRequest: "PR-20261012-0001",
      gudangId: "g-1",
      purchaseOrderId: "po-1",
    }),
    findPurchaseOrderWithItems: vi.fn().mockResolvedValue({
      id: "po-1",
      items: [
        {
          id: "poi-1",
          barangId: "b-1",
          quantity: 10,
          receivedQuantity: 0,
          cancelledQuantity: 0,
        },
      ],
    }),
    findPurchaseOrderStatus: vi.fn().mockResolvedValue("ORDERED"),
    hasOutstandingItems: vi.fn().mockResolvedValue(true),
    markPurchaseOrderReceived: vi.fn(),
    markPurchaseRequestReceived: vi.fn(),
  };
  return new RestockGoodsReceiptService(
    repository as never,
    { apply: vi.fn().mockResolvedValue({}) } as never,
    { apply: vi.fn(), validate: vi.fn() } as never,
    {} as never,
  );
}

describe("Log Aktivitas verifikasi barang sampai", () => {
  beforeEach(() => Object.values(mocks).forEach((fn) => fn.mockReset()));

  it("mencatat penerimaan bernomor PR beserta nomor GRN", async () => {
    mocks.createGoodsReceipt.mockResolvedValue({
      id: "grn-1",
      grnNumber: "GRN-20261017-0001",
    });

    await createService().receive({
      purchaseRequestId: "pr-1",
      receivedItems: { "b-1": 6 },
      fotoBukti: ["/uploads/bukti.webp"],
      closePO: false,
      canIncreasePurchaseOrder: false,
      actorId: "user-1",
      tenantId: "tenant-1",
    });

    expect(mocks.logActivitySafe).toHaveBeenCalledWith({
      action: "RECEIVE",
      subject: "Pengajuan Restock PR-20261012-0001",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        purchaseRequestId: "pr-1",
        purchaseOrderId: "po-1",
        goodsReceiptId: "grn-1",
        grnNumber: "GRN-20261017-0001",
        items: [{ barangId: "b-1", quantity: 6 }],
        kelebihanKiriman: [],
        jumlahFoto: 1,
        tutupPesanan: false,
      },
    });
  });
});
