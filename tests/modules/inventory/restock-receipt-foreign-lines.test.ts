import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logActivitySafe: vi.fn(),
  createGoodsReceipt: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: mocks.logActivitySafe,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
  },
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

import type { RestockPurchaseOrderItem } from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import {
  RestockGoodsReceiptService,
  RestockReceiptInvalidError,
  type ReceiveRestockRequestInput,
} from "@/modules/inventory/services/RestockGoodsReceiptService";
import { RestockItemCancellationService } from "@/modules/inventory/services/RestockItemCancellationService";
import { findForeignReceiptLine } from "@/modules/inventory/services/restock-receipt-settlement";

/** Pesanan gabungan: kabel milik pengajuan ini, konektor milik pengajuan lain. */
const kabel: RestockPurchaseOrderItem = {
  id: "poi-1",
  barangId: "b-1",
  quantity: 10,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  barang: { id: "b-1", nama: "Kabel Fiber" },
};
const konektorMilikLain: RestockPurchaseOrderItem = {
  id: "poi-2",
  barangId: "b-2",
  quantity: 5,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  barang: { id: "b-2", nama: "Konektor" },
};
const owned = new Set(["b-1"]);

describe("findForeignReceiptLine", () => {
  it("mengabaikan pesanan yang bukan gabungan", () => {
    expect(
      findForeignReceiptLine(
        { receivedItems: { "b-2": 3 } },
        [kabel, konektorMilikLain],
        null,
      ),
    ).toBeNull();
  });

  it("membolehkan barang milik pengajuan ini dan jumlah 0 untuk barang lain", () => {
    expect(
      findForeignReceiptLine(
        { receivedItems: { "b-1": 4, "b-2": 0 }, cancellations: { "b-2": "" } },
        [kabel, konektorMilikLain],
        owned,
      ),
    ).toBeNull();
  });

  it.each([
    ["diterima lewat barangId", { receivedItems: { "b-2": 3 } }],
    ["diterima lewat id item pesanan", { receivedItems: { "poi-2": 1 } }],
    ["dicoret", { receivedItems: {}, cancellations: { "b-2": "Habis" } }],
    ["diganti", { receivedItems: {}, substitutions: { "b-2": "b-9" } }],
  ])("menolak barang milik pengajuan lain yang %s", (_label, input) => {
    expect(
      findForeignReceiptLine(input, [kabel, konektorMilikLain], owned),
    ).toBe("Konektor");
  });
});

function createRepository() {
  return {
    findPurchaseRequestForReceipt: vi.fn().mockResolvedValue({
      id: "pr-1",
      nomorRequest: "PR-20261109-0001",
      gudangId: "g-1",
      purchaseOrderId: "po-1",
      status: "ORDERED",
      receivableBarangIds: ["b-1"],
    }),
    findPurchaseOrderWithItems: vi.fn().mockResolvedValue({
      id: "po-1",
      poNumber: "PO-20261109-0001",
      status: "ORDERED",
      processedById: null,
      issuedAt: null,
      paymentStatus: "UNPAID",
      jasaItemCount: 0,
      goodsReceiptCount: 0,
      items: [kabel, konektorMilikLain],
    }),
    findPurchaseOrderStatus: vi.fn().mockResolvedValue("ORDERED"),
    hasOutstandingItems: vi.fn().mockResolvedValue(true),
    countPurchaseRequestsForPurchaseOrder: vi.fn().mockResolvedValue(2),
    applyItemCancellations: vi.fn(),
    applyReceiptSettlement: vi.fn().mockResolvedValue(true),
    finishPurchaseOrderWithoutDelivery: vi.fn().mockResolvedValue(true),
    recordPurchaseOrderPurchase: vi.fn(),
  };
}

function receive(
  repository: ReturnType<typeof createRepository>,
  input: Partial<ReceiveRestockRequestInput>,
) {
  const substitution = { apply: vi.fn().mockResolvedValue({}) };
  const service = new RestockGoodsReceiptService(
    repository as never,
    substitution as never,
    new RestockItemCancellationService(repository as never),
    {} as never,
  );
  return {
    substitution,
    result: service.receive({
      purchaseRequestId: "pr-1",
      receivedItems: {},
      fotoBukti: ["https://example.test/foto.jpg"],
      closePO: false,
      canIncreasePurchaseOrder: false,
      actorId: "user-gudang",
      tenantId: "tenant-1",
      ...input,
    }),
  };
}

describe("RestockGoodsReceiptService — pesanan gabungan", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("menolak menerima barang milik pengajuan lain sebelum apa pun ditulis", async () => {
    const repository = createRepository();
    const { substitution, result } = receive(repository, {
      receivedItems: { "b-1": 2, "b-2": 5 },
    });

    await expect(result).rejects.toBeInstanceOf(RestockReceiptInvalidError);
    await expect(result).rejects.toThrow(/Konektor milik pengajuan lain/);
    expect(substitution.apply).not.toHaveBeenCalled();
    expect(mocks.createGoodsReceipt).not.toHaveBeenCalled();
    expect(repository.applyReceiptSettlement).not.toHaveBeenCalled();
  });

  it("menolak mencoret barang milik pengajuan lain saat selesai tanpa kiriman", async () => {
    const repository = createRepository();
    const { result } = receive(repository, {
      fotoBukti: [],
      closePO: true,
      cancellations: { "b-2": "Barang habis di toko" },
    });

    await expect(result).rejects.toThrow(/Konektor milik pengajuan lain/);
    expect(
      repository.finishPurchaseOrderWithoutDelivery,
    ).not.toHaveBeenCalled();
  });
});
