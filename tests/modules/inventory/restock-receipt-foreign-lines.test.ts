import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));

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
vi.mock("@/modules/procurement", () => ({
  GoodsReceiptExceedsRemainingError: class extends Error {},
  GoodsReceiptInvalidError: class extends Error {},
  PurchaseOrderNotFoundError: class extends Error {},
  PurchaseRequestAlreadyOrderedError: class extends Error {},
  PurchaseRequestNotOrderableError: class extends Error {},
  SupplierNotActiveError: class extends Error {},
}));

import { ENTRY_LINES_MISMATCH_MESSAGE } from "@/modules/inventory/services/RestockGoodsReceiptService";

import {
  createReceiptFixture,
  kabel,
  konektor,
  makeOrder,
  makeRequest,
  receiveWith,
  type ReceiptFixture,
} from "./restock-receipt-fixtures";

/** Pesanan gabungan: kabel milik pengajuan ini, konektor milik pengajuan lain. */
function createMergedOrderFixture(): ReceiptFixture {
  return createReceiptFixture({
    request: makeRequest(),
    order: makeOrder({ items: [kabel, konektor] }),
    linkedRequests: 2,
  });
}

describe("RestockGoodsReceiptService — pesanan gabungan", () => {
  beforeEach(() => mocks.logActivitySafe.mockReset());

  it("hanya meminta jumlah barang milik pengajuan ini", async () => {
    const fixture = createMergedOrderFixture();

    const outcome = await receiveWith(fixture, {
      receivedItems: { "b-1": 2, "b-2": 5 },
    });

    expect(outcome).toEqual({
      success: false,
      code: "INVALID",
      error: ENTRY_LINES_MISMATCH_MESSAGE,
    });
    expect(fixture.goodsReceipts.create).not.toHaveBeenCalled();
  });

  it("tidak mengganti barang milik pengajuan lain", async () => {
    const fixture = createMergedOrderFixture();

    const outcome = await receiveWith(fixture, {
      receivedItems: { "b-1": 2 },
      substitutions: { "b-2": "b-9" },
    });

    expect(outcome).toMatchObject({ success: false, code: "INVALID" });
    expect(fixture.substitution.apply).not.toHaveBeenCalled();
  });

  it("rencana pengajuan terakhir mencoret semua sisa pesanan; bila pengajuan lain masih terbuka hanya pengajuan ini yang selesai", async () => {
    const fixture = createMergedOrderFixture();
    fixture.repository.closeRequest.mockResolvedValue({
      isWritten: true,
      isLastOpenRequest: false,
    });

    const outcome = await receiveWith(fixture, { receivedItems: { "b-1": 6 } });

    expect(fixture.repository.closeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ifOtherRequestsOpen: "SETTLE_REQUEST",
        ifLastOpenRequest: {
          settlement: "SETTLE_ORDER",
          cancellations: [
            expect.objectContaining({
              purchaseOrderItemId: "poi-1",
              cancelledQuantity: 4,
            }),
            expect.objectContaining({
              purchaseOrderItemId: "poi-2",
              cancelledQuantity: 5,
            }),
          ],
        },
      }),
    );
    expect(outcome).toMatchObject({
      success: true,
      data: { purchaseRequestStatus: "RECEIVED", notEntered: [] },
    });
  });

  it("pengajuan terakhir yang terbuka melaporkan semua sisa yang dicoret", async () => {
    const fixture = createMergedOrderFixture();

    const outcome = await receiveWith(fixture, { receivedItems: { "b-1": 6 } });

    expect(outcome).toMatchObject({
      success: true,
      data: {
        notEntered: [
          { barangId: "b-1", barangName: "Kabel Fiber", quantity: 4 },
          { barangId: "b-2", barangName: "Konektor", quantity: 5 },
        ],
      },
    });
  });

  it("barang yang sama dipakai dua pengajuan: rencana terakhir mencoret sisa item bersama sesudah GRN", async () => {
    const kabelBersama = { ...kabel, quantity: 10 };
    const fixture = createReceiptFixture({
      request: makeRequest({
        lines: [{ barangId: "b-1", jumlah: 5, barang: kabel.barang }],
      }),
      order: makeOrder({ items: [kabelBersama] }),
      linkedRequests: 2,
    });
    fixture.repository.closeRequest.mockResolvedValue({
      isWritten: true,
      isLastOpenRequest: false,
    });

    const outcome = await receiveWith(fixture, { receivedItems: { "b-1": 5 } });

    expect(fixture.goodsReceipts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ purchaseOrderItemId: "poi-1", barangId: "b-1", quantity: 5 }],
      }),
    );
    expect(fixture.repository.closeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ifOtherRequestsOpen: "SETTLE_REQUEST",
        ifLastOpenRequest: {
          settlement: "SETTLE_ORDER",
          cancellations: [
            expect.objectContaining({
              purchaseOrderItemId: "poi-1",
              cancelledQuantity: 5,
              expected: {
                quantity: 10,
                receivedQuantity: 5,
                cancelledQuantity: 0,
              },
            }),
          ],
        },
      }),
    );
    expect(outcome).toMatchObject({ success: true, data: { notEntered: [] } });
  });
});
