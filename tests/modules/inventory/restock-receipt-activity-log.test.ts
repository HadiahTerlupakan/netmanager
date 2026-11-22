import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: mocks.logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/procurement", () => ({
  GoodsReceiptExceedsRemainingError: class extends Error {},
  GoodsReceiptInvalidError: class extends Error {},
  PurchaseOrderNotFoundError: class extends Error {},
  PurchaseRequestAlreadyOrderedError: class extends Error {},
  PurchaseRequestNotOrderableError: class extends Error {},
  SupplierNotActiveError: class extends Error {},
}));

import {
  createReceiptFixture,
  kabel,
  makeOrder,
  receiveWith,
} from "./restock-receipt-fixtures";

describe("Log Aktivitas Lapor Barang Sampai", () => {
  beforeEach(() => mocks.logActivitySafe.mockReset());

  it("mencatat barang masuk bernomor pengajuan beserta GRN dan sisa yang tidak dimasukkan", async () => {
    const fixture = createReceiptFixture();
    fixture.goodsReceipts.create.mockResolvedValue({
      id: "grn-1",
      grnNumber: "GRN-20261121-0001",
    });

    await receiveWith(fixture, {
      receivedItems: { "b-1": 6 },
      fotoBukti: ["/uploads/bukti.webp"],
      actorId: "user-1",
    });

    expect(mocks.logActivitySafe).toHaveBeenCalledWith({
      action: "RECEIVE",
      subject: "Pengajuan Restock PR-20261121-0001",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        purchaseRequestId: "pr-1",
        purchaseOrderId: "po-1",
        goodsReceiptId: "grn-1",
        grnNumber: "GRN-20261121-0001",
        items: [{ barangId: "b-1", quantity: 6 }],
        kelebihanKiriman: [],
        tidakDimasukkan: [{ barangId: "b-1", jumlah: 4 }],
        jumlahFoto: 1,
        pesananDibuatOtomatis: false,
        pengajuanSelesai: true,
      },
    });
  });

  it("pada pesanan gabungan yang masih dipakai pengajuan lain, tidak ada sisa yang dicatat dicoret", async () => {
    const fixture = createReceiptFixture({ linkedRequests: 2 });
    fixture.repository.closeRequest.mockResolvedValue({
      isWritten: true,
      isLastOpenRequest: false,
    });

    await receiveWith(fixture, { receivedItems: { "b-1": 6 } });

    expect(mocks.logActivitySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          goodsReceiptId: "grn-1",
          tidakDimasukkan: [],
          pengajuanSelesai: true,
        }),
      }),
    );
  });

  it("pengajuan lama yang diselesaikan tanpa barang tambahan dicatat tanpa GRN", async () => {
    const fixture = createReceiptFixture({
      order: makeOrder({ items: [{ ...kabel, receivedQuantity: 6 }] }),
    });

    await receiveWith(fixture, { receivedItems: { "b-1": 0 }, fotoBukti: [] });

    expect(mocks.logActivitySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RECEIVE",
        details: expect.objectContaining({
          goodsReceiptId: null,
          grnNumber: null,
          items: [],
          tidakDimasukkan: [{ barangId: "b-1", jumlah: 4 }],
          jumlahFoto: 0,
          pengajuanSelesai: true,
        }),
      }),
    );
  });
});
