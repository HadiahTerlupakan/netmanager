/**
 * Unit tests untuk anulir sisa pesanan saat verifikasi kedatangan restock.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  IRestockGoodsReceiptRepository,
  RestockPurchaseOrderItem,
} from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import {
  MAX_CANCEL_REASON_LENGTH,
  RestockCancellationInvalidError,
  RestockItemCancellationService,
} from "@/modules/inventory/services/RestockItemCancellationService";

vi.mock("@/lib/logger", () => ({
  logger: { logActivity: vi.fn().mockResolvedValue(undefined) },
}));

const purchaseOrderItems: RestockPurchaseOrderItem[] = [
  {
    id: "po-item-1",
    barangId: "barang-1",
    quantity: 10,
    receivedQuantity: 2,
    cancelledQuantity: 0,
    barang: { id: "barang-1", nama: "Kabel Fiber" },
  },
  {
    id: "po-item-2",
    barangId: "barang-2",
    quantity: 4,
    receivedQuantity: 1,
    cancelledQuantity: 3,
    barang: { id: "barang-2", nama: "Kabel Dropcore" },
  },
];

function createService() {
  const applyItemCancellations = vi.fn().mockResolvedValue(undefined);
  const repository = {
    applyItemCancellations,
  } as unknown as IRestockGoodsReceiptRepository;

  return {
    service: new RestockItemCancellationService(repository),
    applyItemCancellations,
  };
}

const baseInput = {
  purchaseOrderId: "po-1",
  purchaseOrderItems,
  receivedQuantityByItemId: {},
  tenantId: "tenant-1",
  actorId: "user-1",
  referenceNumber: "PR-001",
};

describe("RestockItemCancellationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menganulir seluruh sisa pesanan beserta alasannya", async () => {
    const { service, applyItemCancellations } = createService();

    const resolved = await service.apply({
      ...baseInput,
      cancellations: { "barang-1": "Tidak dibelikan" },
    });

    expect(resolved).toEqual([
      {
        purchaseOrderItemId: "po-item-1",
        barangId: "barang-1",
        cancelledQuantity: 8,
        reason: "Tidak dibelikan",
      },
    ]);
    expect(applyItemCancellations).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseOrderId: "po-1",
        cancellations: [
          {
            purchaseOrderItemId: "po-item-1",
            cancelledQuantity: 8,
            reason: "Tidak dibelikan",
          },
        ],
      }),
    );
  });

  it("mengurangi jumlah yang diterima pada submit yang sama", async () => {
    const { service } = createService();

    const resolved = await service.apply({
      ...baseInput,
      receivedQuantityByItemId: { "po-item-1": 5 },
      cancellations: { "barang-1": "Stok supplier kosong" },
    });

    expect(resolved[0].cancelledQuantity).toBe(3);
  });

  it("mengabaikan alasan kosong", async () => {
    const { service, applyItemCancellations } = createService();

    const resolved = await service.apply({
      ...baseInput,
      cancellations: { "barang-1": "   " },
    });

    expect(resolved).toEqual([]);
    expect(applyItemCancellations).not.toHaveBeenCalled();
  });

  it("menolak anulir item yang sudah tidak punya sisa pesanan", async () => {
    const { service } = createService();

    await expect(
      service.apply({
        ...baseInput,
        cancellations: { "barang-2": "Tidak dibelikan" },
      }),
    ).rejects.toThrow("tidak punya sisa pesanan untuk dianulir");
  });

  it("menolak barang yang tidak ada di purchase order", async () => {
    const { service } = createService();

    await expect(
      service.apply({
        ...baseInput,
        cancellations: { "barang-404": "Tidak dibelikan" },
      }),
    ).rejects.toThrow(RestockCancellationInvalidError);
  });

  it("menolak alasan yang melebihi batas panjang", async () => {
    const { service } = createService();

    await expect(
      service.apply({
        ...baseInput,
        cancellations: { "barang-1": "x".repeat(MAX_CANCEL_REASON_LENGTH + 1) },
      }),
    ).rejects.toThrow("maksimal 255 karakter");
  });
});
