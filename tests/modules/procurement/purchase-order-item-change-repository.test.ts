import { describe, expect, it, vi } from "vitest";

import { PurchaseOrderItemChangeRepository } from "@/modules/procurement/repositories/PurchaseOrderItemChangeRepository";
import type { ApplyPurchaseOrderItemChangeInput } from "@/modules/procurement/domain/ports/IPurchaseOrderItemChangeRepository";

interface FakeItem {
  id: string;
  purchaseOrderId: string;
  barangId: string;
  quantity: number;
  receivedQuantity: number;
  cancelledQuantity: number;
  unitPrice: number;
}

function createDb(options: {
  status?: string;
  ppnRate?: number;
  receivedQuantity?: number;
  payments?: number[];
}) {
  const items: FakeItem[] = [
    {
      id: "poi-4core",
      purchaseOrderId: "po-1",
      barangId: "b-4core",
      quantity: 4000,
      receivedQuantity: options.receivedQuantity ?? 0,
      cancelledQuantity: 0,
      unitPrice: 10_000,
    },
  ];
  const tx = {
    purchaseOrderItem: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; purchaseOrderId: string } }) =>
          items.find(
            (item) =>
              item.id === where.id &&
              item.purchaseOrderId === where.purchaseOrderId,
          ) ?? null,
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { quantity: number };
        }) => {
          const item = items.find((candidate) => candidate.id === where.id)!;
          item.quantity = data.quantity;
          return item;
        },
      ),
      createMany: vi.fn(
        async ({ data }: { data: Array<Omit<FakeItem, "id">> }) => {
          data.forEach((item, index) =>
            items.push({
              ...item,
              id: `poi-new-${index}`,
              receivedQuantity: 0,
              cancelledQuantity: 0,
            }),
          );
          return { count: data.length };
        },
      ),
      findMany: vi.fn(async () => items),
    },
    purchaseOrderJasaItem: { findMany: vi.fn(async () => []) },
    purchaseRequestItem: { createMany: vi.fn() },
    purchaseRequest: { updateMany: vi.fn() },
    expense: {
      findMany: vi.fn(async () =>
        (options.payments ?? []).map((amount) => ({ amount })),
      ),
    },
    $queryRaw: vi.fn(async () => []),
    purchaseOrder: {
      findUnique: vi.fn(async () => ({
        id: "po-1",
        poNumber: "PO/2026/10/0008",
        tenantId: "tenant-1",
        status: options.status ?? "ORDERED",
        grandTotal: 40_000_000,
        ppnRate: options.ppnRate ?? 0,
        items: items.map((item) => ({ ...item, barang: { nama: item.id } })),
        purchaseRequests: [{ id: "pr-old" }],
      })),
      findUniqueOrThrow: vi.fn(async () => ({
        status: options.status ?? "ORDERED",
        items,
      })),
      update: vi.fn(),
    },
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return { repository: new PurchaseOrderItemChangeRepository(db as never), tx };
}

const allow = (): void => undefined;

const splitCable: ApplyPurchaseOrderItemChangeInput = {
  purchaseOrderId: "po-1",
  poNumber: "PO/2026/10/0008",
  tenantId: "tenant-1",
  actorId: "user-1",
  quantityChanges: [{ purchaseOrderItemId: "poi-4core", quantity: 2000 }],
  additions: [{ barangId: "b-2core", quantity: 2000, unitPrice: 7_000 }],
  purchaseRequestId: "pr-old",
};

describe("PurchaseOrderItemChangeRepository.applyItemChange", () => {
  it("shrinks the line, adds the new barang to the PO and its request, and reprices with PPN", async () => {
    const { repository, tx } = createDb({ ppnRate: 11 });

    const result = await repository.applyItemChange(splitCable, allow);

    expect(tx.purchaseOrderItem.update).toHaveBeenCalledWith({
      where: { id: "poi-4core" },
      data: { quantity: 2000, totalPrice: 20_000_000 },
    });
    expect(tx.purchaseOrderItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          purchaseOrderId: "po-1",
          barangId: "b-2core",
          quantity: 2000,
          unitPrice: 7_000,
          totalPrice: 14_000_000,
          tenantId: "tenant-1",
        },
      ],
    });
    expect(tx.purchaseRequestItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          purchaseRequestId: "pr-old",
          barangId: "b-2core",
          jumlah: 2000,
          hargaPerUnit: 7_000,
          totalHarga: 14_000_000,
          tenantId: "tenant-1",
        }),
      ],
    });
    // 20 jt + 14 jt = 34 jt, PPN 11% = 3,74 jt.
    expect(tx.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "po-1" },
      data: {
        totalAmount: 34_000_000,
        ppnAmount: 3_740_000,
        grandTotal: 37_740_000,
      },
    });
    expect(result).toEqual({
      status: "ORDERED",
      paymentStatus: "UNPAID",
      grandTotal: 37_740_000,
    });
  });

  it("skips the request item when the PO has no linked request", async () => {
    const { repository, tx } = createDb({});

    await repository.applyItemChange(
      { ...splitCable, purchaseRequestId: null },
      allow,
    );

    expect(tx.purchaseRequestItem.createMany).not.toHaveBeenCalled();
  });

  it("locks the PO and its lines before reading them for the re-check", async () => {
    const { repository, tx } = createDb({});
    const assertStillValid = vi.fn();

    await repository.applyItemChange(splitCable, assertStillValid);

    const [lockPo, lockItems] = tx.$queryRaw.mock.invocationCallOrder;
    const [read] = tx.purchaseOrder.findUnique.mock.invocationCallOrder;
    expect(lockPo).toBeLessThan(read);
    expect(lockItems).toBeLessThan(read);
    expect(assertStillValid).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ORDERED",
        items: [expect.objectContaining({ id: "poi-4core", quantity: 4000 })],
      }),
    );
  });

  it("writes nothing when the re-check fails", async () => {
    const { repository, tx } = createDb({});

    await expect(
      repository.applyItemChange(splitCable, () => {
        throw new Error("sudah diterima");
      }),
    ).rejects.toThrow("sudah diterima");
    expect(tx.purchaseOrderItem.update).not.toHaveBeenCalled();
    expect(tx.purchaseOrderItem.createMany).not.toHaveBeenCalled();
  });

  it("refuses an item that is not on the locked PO", async () => {
    const { repository, tx } = createDb({});

    await expect(
      repository.applyItemChange(
        {
          ...splitCable,
          quantityChanges: [{ purchaseOrderItemId: "poi-other", quantity: 1 }],
        },
        allow,
      ),
    ).rejects.toThrow("Item PO poi-other tidak ditemukan");
    expect(tx.purchaseOrderItem.update).not.toHaveBeenCalled();
  });

  it("counts only this tenant's PO payments", async () => {
    const { repository, tx } = createDb({});

    await repository.applyItemChange(splitCable, allow);

    expect(tx.expense.findMany).toHaveBeenCalledWith({
      where: {
        invoiceNumber: "PO/2026/10/0008",
        tenantId: "tenant-1",
        category: "Purchase Order Payment",
      },
      select: { amount: true },
    });
  });

  it("turns a fully paid PO into partially paid once its total grows", async () => {
    const { repository } = createDb({ payments: [40_000_000] });

    const result = await repository.applyItemChange(
      { ...splitCable, quantityChanges: [] },
      allow,
    );

    expect(result.paymentStatus).toBe("PARTIAL");
  });

  it("turns a partially paid PO into paid once its total drops to what was paid", async () => {
    const { repository } = createDb({ payments: [34_000_000] });

    const result = await repository.applyItemChange(splitCable, allow);

    expect(result.paymentStatus).toBe("PAID");
  });

  it("closes the PO and its requests when the reduction leaves nothing outstanding", async () => {
    const { repository, tx } = createDb({
      status: "PARTIAL",
      receivedQuantity: 2000,
    });

    const result = await repository.applyItemChange(
      { ...splitCable, additions: [] },
      allow,
    );

    expect(result.status).toBe("RECEIVED");
    expect(tx.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "po-1" },
      data: { status: "RECEIVED", receivedById: "user-1" },
    });
    expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: { purchaseOrderId: "po-1" },
      data: { status: "RECEIVED" },
    });
  });

  it("keeps the PO open while something is still outstanding", async () => {
    const { repository, tx } = createDb({
      status: "PARTIAL",
      receivedQuantity: 1500,
    });

    const result = await repository.applyItemChange(splitCable, allow);

    expect(result.status).toBe("PARTIAL");
    expect(tx.purchaseRequest.updateMany).not.toHaveBeenCalled();
  });
});
